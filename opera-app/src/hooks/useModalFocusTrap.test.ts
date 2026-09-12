import { describe, expect, it } from 'vitest';

import {
  getFocusTrapBoundaryTarget,
  selectReturnFocusTarget,
} from './useModalFocusTrap';

describe('modal focus trap boundaries', () => {
  it('pulls forward Tab back to the first control when focus escaped the dialog', () => {
    expect(getFocusTrapBoundaryTarget({
      shiftKey: false,
      activeInside: false,
      activeIsFirst: false,
      activeIsLast: false,
    })).toBe('first');
  });

  it('pulls reverse Tab back to the last control when focus escaped the dialog', () => {
    expect(getFocusTrapBoundaryTarget({
      shiftKey: true,
      activeInside: false,
      activeIsFirst: false,
      activeIsLast: false,
    })).toBe('last');
  });

  it('does not wrap while focus moves between interior controls', () => {
    expect(getFocusTrapBoundaryTarget({
      shiftKey: false,
      activeInside: true,
      activeIsFirst: true,
      activeIsLast: false,
    })).toBeNull();
  });
});

describe('modal return focus', () => {
  it('prefers the actual connected opener over the fallback', () => {
    const opener = { isConnected: true };
    const fallback = { isConnected: true };

    expect(selectReturnFocusTarget(opener, fallback)).toBe(opener);
  });

  it('uses the fallback when focus has fallen back to the document body', () => {
    const body = { isConnected: true };
    const fallback = { isConnected: true };

    expect(selectReturnFocusTarget(body, fallback, [body])).toBe(fallback);
  });

  it('uses the fallback when the original opener was removed', () => {
    const removedOpener = { isConnected: false };
    const fallback = { isConnected: true };

    expect(selectReturnFocusTarget(removedOpener, fallback)).toBe(fallback);
  });
});
