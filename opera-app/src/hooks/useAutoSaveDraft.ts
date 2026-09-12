import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { addDraftFlushListeners, persistDraft } from '../lib/draftPersistence';
import {
  flowKindFromDraftKey,
  readStoredDraftSavedAt,
  recordCreationActivity,
} from '../lib/creationActivity';
import { notifyDraftsChanged } from './useRecentDrafts';

const DEBOUNCE_MS = 1500;
const DRAFT_KEY_PREFIX = 'opera-draft-';

interface UseAutoSaveDraftInput<T> {
  /** 草稿键名，会被自动加上 opera-draft- 前缀 */
  key: string;
  /** 任意可序列化的草稿对象；null/undefined 视为不保存 */
  value: T | null | undefined;
  /** 草稿是否“没有内容”；返回 true 时跳过保存，绝不删除旧稿 */
  isEmpty?: (value: T) => boolean;
}

/**
 * 防抖自动保存草稿到 localStorage，并响应导航/页面离开前的显式同步 flush。
 * 不依赖 unmount cleanup：React StrictMode 的重复挂载不会触发意外覆盖。
 */
export function useAutoSaveDraft<T>({ key, value, isEmpty }: UseAutoSaveDraftInput<T>): void {
  const storageKey = `${DRAFT_KEY_PREFIX}${key}`;
  const activityKind = flowKindFromDraftKey(key);
  const valueRef = useRef<T | null | undefined>(value);
  const isEmptyRef = useRef(isEmpty);

  // layout effect makes the latest committed value available before a navigation click.
  useLayoutEffect(() => {
    valueRef.current = value;
    isEmptyRef.current = isEmpty;
  }, [isEmpty, value]);

  const flush = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const storage = window.localStorage;
      const legacySavedAt = activityKind
        ? readStoredDraftSavedAt({ storage, draftStorageKey: storageKey })
        : null;
      const savedAt = new Date();
      const result = persistDraft({
        storage,
        storageKey,
        value: valueRef.current,
        isEmpty: isEmptyRef.current,
        now: () => savedAt.toISOString(),
      });
      const legacyActivity = activityKind && legacySavedAt
        ? recordCreationActivity({ storage, kind: activityKind, at: legacySavedAt })
        : 'existing';
      const currentActivity = result === 'saved' && activityKind
        ? recordCreationActivity({ storage, kind: activityKind, at: savedAt })
        : 'existing';

      if (result !== 'failed' || legacyActivity === 'added' || currentActivity === 'added') {
        notifyDraftsChanged();
      }
    } catch {
      // Ignore environments where reading localStorage itself is unavailable.
    }
  }, [activityKind, storageKey]);

  // Keep all synchronous flush entry points on one implementation.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    return addDraftFlushListeners(window, flush);
  }, [flush]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handle = window.setTimeout(flush, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [flush, value]);
}

export const DRAFT_KEY_PREFIX_EXPORT = DRAFT_KEY_PREFIX;
