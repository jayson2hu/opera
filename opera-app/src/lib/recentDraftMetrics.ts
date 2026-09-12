import type { FlowKind } from '../types';
import { toLocalDateKey } from './creationActivity';

export type DraftProgress = 25 | 60 | 100;

export interface DraftProgressInfo {
  progress: DraftProgress;
  statusLabel: string;
}

interface DatedDraft {
  kind: FlowKind;
  savedAt: string;
}

interface DatedActivity {
  kind: FlowKind;
  date: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasMeaningfulResult(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (!isRecord(value)) return false;
  return Object.values(value).some((item) => {
    if (typeof item === 'string') return item.trim().length > 0;
    if (Array.isArray(item)) return item.length > 0;
    return item !== null && item !== undefined;
  });
}

export function deriveDraftProgress(payload: unknown): DraftProgressInfo {
  const value = isRecord(payload) ? payload : {};
  const resultStatus = value.resultStatus;
  const hasResult = hasMeaningfulResult(value.result);

  if (resultStatus === 'complete' || (resultStatus === undefined && hasResult)) {
    return { progress: 100, statusLabel: '✓ 已完成 · 可复用' };
  }
  if (hasResult) {
    return { progress: 60, statusLabel: '进行中 · 已生成部分内容' };
  }
  return { progress: 25, statusLabel: '草稿阶段' };
}

export function getCreationStreak(savedDates: Iterable<string>, now = new Date()): number {
  const activeDays = new Set<string>();
  for (const savedAt of savedDates) {
    const date = toLocalDateKey(savedAt);
    if (date) activeDays.add(date);
  }

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  let streak = 0;
  while (activeDays.has(toLocalDateKey(cursor) ?? '')) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function countCreationDaysThisMonth(
  activities: Iterable<DatedActivity>,
  now = new Date(),
): Record<FlowKind, number> {
  const counts: Record<FlowKind, number> = { wechat: 0, adapter: 0, composer: 0 };
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counted = new Set<string>();
  for (const activity of activities) {
    const date = toLocalDateKey(activity.date);
    const identity = date ? `${date}:${activity.kind}` : '';
    if (!date?.startsWith(`${currentMonth}-`) || counted.has(identity)) continue;
    counted.add(identity);
    counts[activity.kind] += 1;
  }
  return counts;
}

/** @deprecated Use countCreationDaysThisMonth for honest activity-day semantics. */
export function countDraftsThisMonth(
  drafts: Iterable<DatedDraft>,
  now = new Date(),
): Record<FlowKind, number> {
  return countCreationDaysThisMonth(
    Array.from(drafts, (draft) => ({ kind: draft.kind, date: draft.savedAt })),
    now,
  );
}
