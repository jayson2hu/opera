import type { FlowKind } from '../types';

/**
 * One immutable key per local calendar day and flow. Existing entries are never
 * rewritten, so overwriting a `*-current` draft cannot erase activity history.
 */
export const CREATION_ACTIVITY_STORAGE_PREFIX = 'opera-creation-activity-v1:';

export interface CreationActivity {
  kind: FlowKind;
  date: string;
}

export type CreationActivityWriteResult = 'added' | 'existing' | 'failed';

type ActivityReadStorage = Pick<Storage, 'length' | 'key'>;
type ActivityWriteStorage = Pick<Storage, 'getItem' | 'setItem'>;
type StoredDraftStorage = Pick<Storage, 'getItem'>;

const FLOW_KINDS = new Set<FlowKind>(['wechat', 'adapter', 'composer']);
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFlowKind(value: string): value is FlowKind {
  return FLOW_KINDS.has(value as FlowKind);
}

function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Normalize an ISO timestamp or an existing YYYY-MM-DD key to a local date. */
export function toLocalDateKey(value: Date | string): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatLocalDate(value);
  }

  const trimmed = value.trim();
  const dateKeyMatch = DATE_KEY_PATTERN.exec(trimmed);
  if (dateKeyMatch) {
    const year = Number(dateKeyMatch[1]);
    const month = Number(dateKeyMatch[2]);
    const day = Number(dateKeyMatch[3]);
    const candidate = new Date(year, month - 1, day, 12);
    if (
      candidate.getFullYear() === year
      && candidate.getMonth() === month - 1
      && candidate.getDate() === day
    ) {
      return formatLocalDate(candidate);
    }
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : formatLocalDate(parsed);
}

export function flowKindFromDraftKey(key: string): FlowKind | null {
  const withoutPrefix = key.startsWith('opera-draft-')
    ? key.slice('opera-draft-'.length)
    : key;
  const candidate = withoutPrefix.split('-', 1)[0] ?? '';
  return isFlowKind(candidate) ? candidate : null;
}

export function creationActivityStorageKey(kind: FlowKind, date: string): string {
  return `${CREATION_ACTIVITY_STORAGE_PREFIX}${date}:${kind}`;
}

function parseActivityStorageKey(key: string | null): CreationActivity | null {
  if (!key?.startsWith(CREATION_ACTIVITY_STORAGE_PREFIX)) return null;
  const suffix = key.slice(CREATION_ACTIVITY_STORAGE_PREFIX.length);
  const separator = suffix.lastIndexOf(':');
  if (separator < 0) return null;

  const date = toLocalDateKey(suffix.slice(0, separator));
  const kind = suffix.slice(separator + 1);
  return date && isFlowKind(kind) ? { date, kind } : null;
}

/** Read all immutable activity keys. Invalid or future-format keys are ignored. */
export function readCreationActivities(storage: ActivityReadStorage): CreationActivity[] {
  const activities = new Map<string, CreationActivity>();
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const activity = parseActivityStorageKey(storage.key(index));
      if (!activity) continue;
      activities.set(`${activity.date}:${activity.kind}`, activity);
    }
  } catch {
    return [];
  }
  return Array.from(activities.values()).sort(
    (left, right) => right.date.localeCompare(left.date) || left.kind.localeCompare(right.kind),
  );
}

/** Merge ledger data with legacy current-draft timestamps without double counting. */
export function mergeCreationActivities(
  ...sources: ReadonlyArray<Iterable<CreationActivity>>
): CreationActivity[] {
  const merged = new Map<string, CreationActivity>();
  for (const source of sources) {
    for (const activity of source) {
      const date = toLocalDateKey(activity.date);
      if (!date || !isFlowKind(activity.kind)) continue;
      merged.set(`${date}:${activity.kind}`, { date, kind: activity.kind });
    }
  }
  return Array.from(merged.values()).sort(
    (left, right) => right.date.localeCompare(left.date) || left.kind.localeCompare(right.kind),
  );
}

/** Add an activity day if absent; an existing day/flow entry is never overwritten. */
export function recordCreationActivity({
  storage,
  kind,
  at = new Date(),
}: {
  storage: ActivityWriteStorage;
  kind: FlowKind;
  at?: Date | string;
}): CreationActivityWriteResult {
  const date = toLocalDateKey(at);
  if (!date) return 'failed';

  const storageKey = creationActivityStorageKey(kind, date);
  try {
    if (storage.getItem(storageKey) !== null) return 'existing';
    storage.setItem(storageKey, at instanceof Date ? at.toISOString() : at);
    return 'added';
  } catch {
    return 'failed';
  }
}

/** Read the timestamp from a legacy/current draft before that fixed key is replaced. */
export function readStoredDraftSavedAt({
  storage,
  draftStorageKey,
}: {
  storage: StoredDraftStorage;
  draftStorageKey: string;
}): string | null {
  try {
    const raw = storage.getItem(draftStorageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.savedAt !== 'string') return null;
    return toLocalDateKey(parsed.savedAt) ? parsed.savedAt : null;
  } catch {
    return null;
  }
}
