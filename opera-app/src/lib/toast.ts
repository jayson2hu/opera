import { useSyncExternalStore } from 'react';

interface ToastState {
  id: number;
  message: string;
}

let state: ToastState | null = null;
const listeners = new Set<() => void>();
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;

const TOAST_DURATION_MS = 1600;

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: ToastState | null) {
  state = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastState | null {
  return state;
}

/**
 * 触发顶部 Toast 提示。1.6s 自动清空；连续调用只显示最后一条。
 */
export function toast(message: string): void {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  setState({ id: nextId++, message });
  timeoutId = setTimeout(() => {
    timeoutId = null;
    setState(null);
  }, TOAST_DURATION_MS);
}

/**
 * 内部 hook：仅供 OperaToast 视觉组件使用。
 */
export function useToast(): ToastState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
