import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 860px)';

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

/**
 * 响应式断点 hook：max-width 860px。SSR-safe（无 window 返回 false）。
 * 用 useSyncExternalStore 实现，避开 react-hooks/set-state-in-effect 规则。
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
