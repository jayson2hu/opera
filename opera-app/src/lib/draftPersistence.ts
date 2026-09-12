export const DRAFT_FLUSH_EVENT = 'opera:draft-flush';

const DRAFT_FLUSH_EVENTS = [DRAFT_FLUSH_EVENT, 'pagehide', 'beforeunload'] as const;

export type DraftStorage = Pick<Storage, 'setItem' | 'removeItem'>;
export type DraftPersistResult = 'saved' | 'skipped' | 'failed';

export interface PersistDraftOptions<T> {
  storage: DraftStorage;
  storageKey: string;
  value: T | null | undefined;
  isEmpty?: (value: T) => boolean;
  now?: () => string;
}

/** Explicit escape hatch after a failed save, never an automatic discard. */
export function confirmDraftNavigation(confirmLoss: (message: string) => boolean, target?: EventTarget): boolean {
  if (dispatchDraftFlush(target)) return true;
  return confirmLoss('当前稿件保存失败。请先取消并导出备份或复制正文。\n确认已备份并继续离开？尚未保存的改动不会自动带到下一个页面。');
}

/** Legacy helper. Empty initialization must never delete existing user content. */
export function persistDraft<T>({
  storage,
  storageKey,
  value,
  isEmpty,
  now = () => new Date().toISOString(),
}: PersistDraftOptions<T>): DraftPersistResult {
  try {
    if (value == null || (isEmpty && isEmpty(value))) {
      return 'skipped';
    }

    const serialized = JSON.stringify({ value, savedAt: now() });
    if (serialized === undefined) {
      return 'failed';
    }

    storage.setItem(storageKey, serialized);
    return 'saved';
  } catch {
    // Storage access, quota, and serialization failures must not interrupt navigation.
    return 'failed';
  }
}

/** Register all lifecycle signals that can require a synchronous draft flush. */
export function addDraftFlushListeners(target: EventTarget, flush: () => void): () => void {
  const listener = () => flush();
  DRAFT_FLUSH_EVENTS.forEach((eventName) => target.addEventListener(eventName, listener));

  return () => {
    DRAFT_FLUSH_EVENTS.forEach((eventName) => target.removeEventListener(eventName, listener));
  };
}

/** Ask every mounted auto-save hook to persist its latest value immediately. */
export function dispatchDraftFlush(target?: EventTarget): boolean {
  const eventTarget = target ?? (typeof window === 'undefined' ? undefined : window);
  if (!eventTarget || typeof Event === 'undefined') return true;
  return eventTarget.dispatchEvent(new Event(DRAFT_FLUSH_EVENT, { cancelable: true }));
}
