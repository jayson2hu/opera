import type { FlowKind, TargetLength, ToneType } from '../types';
import { isComposerResult, isGenerationResult, isWeChatComposeResult } from './draftIntegrity';

export type DraftValue = Record<string, unknown>;
export interface DraftSelection { id?: string; payload?: unknown; newDraft?: boolean; restoreVersion?: boolean }
export interface DraftVersion { id: string; label: string; savedAt: string; value: DraftValue }
export interface WorkspaceRecord {
  schemaVersion: 2;
  revision: number;
  value: DraftValue;
  savedAt: string;
  versions: DraftVersion[];
  migratedFrom?: string;
}
export interface DraftSession {
  id: string;
  kind: FlowKind;
  initialValue: DraftValue;
  revision: number;
  versions: DraftVersion[];
  migratedFrom?: string;
  readError?: string;
}
export type WorkspaceStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const activeDraftKey = (kind: FlowKind) => 'opera-active-draft-' + kind;
export const migrationKey = (legacyId: string) => 'opera-migrated-' + legacyId;
export const isDraftValue = (value: unknown): value is DraftValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const copyDraft = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const draftText = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
export const draftTone = (value: unknown): ToneType | null =>
  value === 'knowledge' || value === 'casual' || value === 'bff' ? value : null;
export const draftLength = (value: unknown, fallback: TargetLength = 'medium'): TargetLength =>
  value === 'short' || value === 'medium' || value === 'long' ? value : fallback;

function newDraftId(kind: FlowKind): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  return 'opera-draft-' + kind + '-' + suffix;
}
export function isWorkspaceRecord(value: unknown): value is WorkspaceRecord {
  return isDraftValue(value) && value.schemaVersion === 2
    && Number.isInteger(value.revision) && Number(value.revision) > 0
    && isDraftValue(value.value) && typeof value.savedAt === 'string'
    && Array.isArray(value.versions)
    && value.versions.every((version) => isDraftValue(version)
      && typeof version.id === 'string' && typeof version.label === 'string'
      && typeof version.savedAt === 'string' && isDraftValue(version.value));
}

function validateSessionResult(session: DraftSession): DraftSession {
  const result = session.initialValue.result;
  const validator = { composer: isComposerResult, adapter: isGenerationResult, wechat: isWeChatComposeResult }[session.kind];
  return result == null || validator(result) ? session : { ...session,
    readError: '草稿正文格式不兼容，已阻止自动覆盖。请先导出备份，原始数据会包含在备份中。' };
}

/** Read only. Safe to run twice during a StrictMode initializer. */
export function readDraftSession(kind: FlowKind, selection?: DraftSelection, storage?: WorkspaceStorage): DraftSession {
  const empty: DraftSession = { id: newDraftId(kind), kind, initialValue: {}, revision: 0, versions: [] };
  try {
    const store = storage ?? window.localStorage;
    if (selection?.newDraft) return { ...empty, initialValue: isDraftValue(selection.payload) ? selection.payload : {} };
    const requestedId = selection?.id ?? store.getItem(activeDraftKey(kind));
    const safeId = requestedId?.startsWith('opera-draft-' + kind + '-') ? requestedId : null;
    let id = safeId ?? 'opera-draft-' + kind + '-current';
    const migratedId = store.getItem(migrationKey(id));
    if (migratedId?.startsWith('opera-draft-' + kind + '-')) {
      // A deleted migrated draft must not resurrect its legacy backup.
      if (!store.getItem(migratedId)) return empty;
      id = migratedId;
    }
    const raw = store.getItem(id);
    if (raw) {
      const record: unknown = JSON.parse(raw);
      if (isWorkspaceRecord(record)) {
        const restoringVersion = selection?.restoreVersion && isDraftValue(selection.payload);
        return validateSessionResult({ id, kind, initialValue: copyDraft(restoringVersion ? selection.payload as DraftValue : record.value),
          revision: record.revision, versions: restoringVersion
            ? appendDraftVersion(copyDraft(record.versions), selection.payload as DraftValue, '恢复的历史版本')
            : copyDraft(record.versions), migratedFrom: record.migratedFrom });
      }
      if (isDraftValue(record) && !('schemaVersion' in record) && isDraftValue(record.value)) {
        return validateSessionResult({ ...empty, initialValue: copyDraft(record.value), migratedFrom: id });
      }
      throw new Error('invalid');
    }
    if (selection && isDraftValue(selection.payload)) return { ...empty, initialValue: copyDraft(selection.payload) };
    return empty;
  } catch {
    return { ...empty, initialValue: isDraftValue(selection?.payload) ? copyDraft(selection.payload) : {},
      readError: '无法安全读取草稿。旧数据未改动；请导出当前内容，检查浏览器存储后重新打开。' };
  }
}

export function appendDraftVersion(versions: DraftVersion[], value: DraftValue, label: string): DraftVersion[] {
  const last = versions.at(-1);
  if (last && JSON.stringify(last.value) === JSON.stringify(value)) return versions;
  return [...versions, { id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + '-' + versions.length,
    label, savedAt: new Date().toISOString(), value: copyDraft(value) }];
}

/** No delete operation. Legacy bytes remain; detects already-observed cross-tab revisions (not atomic CAS). */
export function writeDraftRecord(
  session: DraftSession, value: DraftValue, versions: DraftVersion[], expectedRevision: number, storage?: WorkspaceStorage,
): { ok: true; record: WorkspaceRecord; pointerSaved: boolean } | { ok: false; error: string } {
  if (session.readError) return { ok: false, error: session.readError };
  try {
    const store = storage ?? window.localStorage;
    const raw = store.getItem(session.id);
    const previous: unknown = raw ? JSON.parse(raw) : null;
    if (raw && (!isWorkspaceRecord(previous) || previous.revision !== expectedRevision)) {
      return { ok: false, error: '这篇稿件已在另一页面更新。已阻止覆盖；请导出当前版本，再从草稿箱重新打开并合并。' };
    }
    if (!raw && expectedRevision > 0) return { ok: false, error: '这篇稿件已在其他页面删除。当前文本仍在，请导出备份后新建稿件。' };
    const record: WorkspaceRecord = { schemaVersion: 2, revision: expectedRevision + 1,
      value: copyDraft(value), versions: copyDraft(versions), savedAt: new Date().toISOString(),
      ...(session.migratedFrom ? { migratedFrom: session.migratedFrom } : {}) };
    store.setItem(session.id, JSON.stringify(record));
    let pointerSaved = true;
    try {
      store.setItem(activeDraftKey(session.kind), session.id);
      if (session.migratedFrom) store.setItem(migrationKey(session.migratedFrom), session.id);
    } catch { pointerSaved = false; }
    return { ok: true, record, pointerSaved };
  } catch {
    return { ok: false, error: '草稿未保存：浏览器存储不可用或空间不足。当前内容仍在，请先导出备份，不要刷新。' };
  }
}
export function storedResultKey(value: DraftValue, fallback: string): string {
  return typeof value.resultParameterKey === 'string' ? value.resultParameterKey : fallback;
}
export function resultTargetLength(parameterKey: string | null, fallback: TargetLength): TargetLength {
  try {
    const parts: unknown = JSON.parse(parameterKey ?? 'null');
    if (Array.isArray(parts)) return draftLength(parts[0] === 'composer-v1' || parts[0] === 'wechat-v1' ? parts[4] : parts[2], fallback);
  } catch { /* Legacy drafts use their saved target. */ }
  return fallback;
}
