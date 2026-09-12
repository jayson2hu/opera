import { useSyncExternalStore } from 'react';
import type { FlowKind } from '../types';
import { migrationKey } from '../lib/draftWorkspace';
import {
  countCreationDaysThisMonth,
  deriveDraftProgress,
  getCreationStreak,
  type DraftProgress,
} from '../lib/recentDraftMetrics';
import {
  CREATION_ACTIVITY_STORAGE_PREFIX,
  mergeCreationActivities,
  readCreationActivities,
  toLocalDateKey,
  type CreationActivity,
} from '../lib/creationActivity';

export interface RecentDraft {
  id: string;
  kind: FlowKind;
  emoji: string;
  title: string;
  meta: string;
  flowLabel: string;
  relativeTime: string;
  savedAt: string;
  revision: number;
  progress: DraftProgress;
  statusLabel: string;
  /** 原始草稿 payload，恢复时回写到 Page state */
  payload: unknown;
}

const STORAGE_PREFIX = 'opera-draft-';
const FLOW_META: Record<FlowKind, { emoji: string; label: string }> = {
  wechat: { emoji: '✍️', label: '公众号' },
  adapter: { emoji: '⇋', label: '改写小红书' },
  composer: { emoji: '📒', label: '小红书原创' },
};

const STORAGE_LISTENERS = new Set<() => void>();

function notifyListeners() {
  for (const listener of STORAGE_LISTENERS) listener();
}

function subscribe(callback: () => void): () => void {
  STORAGE_LISTENERS.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (
      !event.key
      || event.key.startsWith(STORAGE_PREFIX)
      || event.key.startsWith(CREATION_ACTIVITY_STORAGE_PREFIX)
    ) {
      callback();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    STORAGE_LISTENERS.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

function formatRelative(savedAt: string): string {
  try {
    const ts = new Date(savedAt).getTime();
    const diff = Date.now() - ts;
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return `${Math.floor(diff / 86_400_000)} 天前`;
  } catch {
    return '';
  }
}

function readRaw(): RecentDraft[] {
  if (typeof window === 'undefined') return [];
  const drafts: RecentDraft[] = [];
  const migratedLegacyKeys = new Set<string>();
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      // Skip well-known non-flow keys
      if (key === 'opera-draft-prefs' || window.localStorage.getItem(migrationKey(key))) continue;

      // Extract flow kind from key: opera-draft-{kind}-{rest}
      const rest = key.slice(STORAGE_PREFIX.length);
      const dashIdx = rest.indexOf('-');
      const kindCandidate = (dashIdx === -1 ? rest : rest.slice(0, dashIdx)) as FlowKind;
      if (!(kindCandidate in FLOW_META)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      let parsed: { value: unknown; savedAt: string; revision?: number; migratedFrom?: string } | null = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed.savedAt !== 'string') continue;
      if (typeof parsed.migratedFrom === 'string') migratedLegacyKeys.add(parsed.migratedFrom);

      const value = parsed.value as { topic?: string; inputText?: string; title?: string; result?: { title?: string } } | null;
      const title =
        (value && (value.result?.title || value.title || value.topic || value.inputText)?.toString().slice(0, 40)) ||
        '(未命名草稿)';

      const relativeTime = formatRelative(parsed.savedAt);
      drafts.push({
        id: key,
        kind: kindCandidate,
        emoji: FLOW_META[kindCandidate].emoji,
        title,
        meta: `${FLOW_META[kindCandidate].label} · ${relativeTime}`,
        flowLabel: FLOW_META[kindCandidate].label,
        relativeTime,
        savedAt: parsed.savedAt,
        revision: parsed.revision ?? 0,
        ...deriveDraftProgress(parsed.value),
        payload: parsed.value,
      });
    }
  } catch {
    return [];
  }
  return drafts.filter((draft) => !migratedLegacyKeys.has(draft.id)).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

let cached: RecentDraft[] = [];
let cacheKey = '';

function getSnapshot(): RecentDraft[] {
  const fresh = readRaw();
  // Include revision: two writes may share a timestamp.
  const key = fresh.map((d) => `${d.id}@${d.savedAt}@${d.revision}`).join('|');
  if (key !== cacheKey) {
    cacheKey = key;
    cached = fresh;
  }
  return cached;
}

function getServerSnapshot(): RecentDraft[] {
  return [];
}

/**
 * 真实读取 localStorage 中所有 opera-draft-* 草稿，按时间 desc 返回前 N 条。
 */
export function useRecentDrafts(limit = 3): RecentDraft[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return all.slice(0, limit);
}

let cachedActivities: CreationActivity[] = [];
let activityCacheKey = '';
const EMPTY_ACTIVITIES: CreationActivity[] = [];

function getActivitySnapshot(): CreationActivity[] {
  if (typeof window === 'undefined') return cachedActivities;
  const legacyActivities = readRaw().flatMap((draft) => {
    const date = toLocalDateKey(draft.savedAt);
    return date ? [{ kind: draft.kind, date }] : [];
  });
  let storedActivities: CreationActivity[] = [];
  try {
    storedActivities = readCreationActivities(window.localStorage);
  } catch { /* The localStorage getter itself may throw in privacy-restricted browsers. */ }
  const fresh = mergeCreationActivities(storedActivities, legacyActivities);
  const key = fresh.map((activity) => `${activity.date}@${activity.kind}`).join('|');
  if (key !== activityCacheKey) {
    activityCacheKey = key;
    cachedActivities = fresh;
  }
  return cachedActivities;
}

function getServerActivitySnapshot(): CreationActivity[] {
  return EMPTY_ACTIVITIES;
}

function useCreationActivities(): CreationActivity[] {
  return useSyncExternalStore(subscribe, getActivitySnapshot, getServerActivitySnapshot);
}

/** Number of consecutive local calendar days with at least one saved draft. */
export function useCreationStreak(): number {
  const activities = useCreationActivities();
  return getCreationStreak(activities.map((activity) => activity.date));
}

/** Unique creation days in the current month, grouped by flow. */
export function useCreationDaysThisMonth(): Record<FlowKind, number> {
  return countCreationDaysThisMonth(useCreationActivities());
}

/**
 * 主动通知 useRecentDrafts 重新扫描（自动保存后/手动删除后调用）。
 * StorageEvent 不会在同窗口内触发，所以需要手动 notify。
 */
export function notifyDraftsChanged(): void {
  notifyListeners();
}

/** 删除单条草稿 */
export function deleteDraft(id: string): boolean {
  if (!/^opera-draft-(wechat|composer|adapter)-/.test(id)) return false;
  try {
    window.localStorage.removeItem(id);
    notifyDraftsChanged();
    return true;
  } catch { return false; }
}

/** Clear saved flow drafts and their indexes, not preferences or creation statistics. */
export function clearAllDrafts(): boolean {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && (/^opera-draft-(wechat|adapter|composer)-/.test(key)
        || /^opera-active-draft-(wechat|adapter|composer)$/.test(key)
        || /^opera-migrated-opera-draft-(wechat|adapter|composer)-/.test(key)
        || key === 'opera.wechat.drafts')) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
    notifyDraftsChanged(); return true;
  } catch { notifyDraftsChanged(); return false; }
}
