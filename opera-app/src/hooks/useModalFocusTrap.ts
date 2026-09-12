import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.getAttribute('aria-hidden') !== 'true');
}

export type FocusTrapBoundaryTarget = 'first' | 'last' | null;

export function selectReturnFocusTarget<T extends { isConnected: boolean }>(
  previouslyFocused: T | null | undefined,
  fallback: T | null | undefined,
  invalidTargets: readonly T[] = [],
): T | null {
  if (
    previouslyFocused?.isConnected
    && !invalidTargets.includes(previouslyFocused)
  ) {
    return previouslyFocused;
  }
  return fallback?.isConnected ? fallback : null;
}

export function getFocusTrapBoundaryTarget({
  shiftKey,
  activeInside,
  activeIsFirst,
  activeIsLast,
}: {
  shiftKey: boolean;
  activeInside: boolean;
  activeIsFirst: boolean;
  activeIsLast: boolean;
}): FocusTrapBoundaryTarget {
  if (shiftKey && (activeIsFirst || !activeInside)) return 'last';
  if (!shiftKey && (activeIsLast || !activeInside)) return 'first';
  return null;
}

interface ModalFocusTrapOptions {
  /** Stable opener/fallback used when the element focused before mount is removed. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Keep keyboard focus inside an aria-modal surface and restore its opener. */
export function useModalFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  options: ModalFocusTrapOptions = {},
): void {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const initialFocus = container.querySelector<HTMLElement>('[data-autofocus]')
      ?? getFocusableElements(container)[0]
      ?? container;
    initialFocus.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      const active = document.activeElement;
      const boundaryTarget = getFocusTrapBoundaryTarget({
        shiftKey: event.shiftKey,
        activeInside: container.contains(active),
        activeIsFirst: active === first,
        activeIsLast: active === last,
      });
      if (boundaryTarget === 'last') {
        event.preventDefault();
        last?.focus();
      } else if (boundaryTarget === 'first') {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const fallbackReturnTarget = options.returnFocusRef?.current;
      const returnTarget = selectReturnFocusTarget<HTMLElement>(
        previouslyFocused,
        fallbackReturnTarget,
        [document.body, document.documentElement],
      );
      returnTarget?.focus({ preventScroll: true });
    };
  }, [containerRef, options.returnFocusRef]);
}
