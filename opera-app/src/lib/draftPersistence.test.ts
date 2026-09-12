import { describe, expect, it, vi } from 'vitest';

import {
  addDraftFlushListeners,
  confirmDraftNavigation,
  dispatchDraftFlush,
  persistDraft,
} from './draftPersistence';

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('draft persistence', () => {
  it('writes a serializable draft with a timestamp', () => {
    const storage = createStorage();

    expect(persistDraft({
      storage,
      storageKey: 'opera-draft-adapter-current',
      value: { text: 'hello' },
      now: () => '2026-07-28T00:00:00.000Z',
    })).toBe('saved');
    expect(storage.values.get('opera-draft-adapter-current')).toBe(JSON.stringify({
      value: { text: 'hello' },
      savedAt: '2026-07-28T00:00:00.000Z',
    }));
});

it('blocks failed flushes unless the user explicitly confirms leaving after backup', () => {
  const target = new EventTarget();
  const confirm = vi.fn(() => false);
  expect(confirmDraftNavigation(confirm, target)).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  target.addEventListener('opera:draft-flush', (event) => event.preventDefault());
  expect(dispatchDraftFlush(target)).toBe(false);
  expect(confirmDraftNavigation(confirm, target)).toBe(false);
  confirm.mockReturnValue(true);
  expect(confirmDraftNavigation(confirm, target)).toBe(true);
});

  it('does not delete existing data when an initial value is empty', () => {
    const storage = createStorage();
    storage.values.set('draft', JSON.stringify({ value: { text: 'old' } }));

    expect(persistDraft({
      storage,
      storageKey: 'draft',
      value: { text: '' },
      isEmpty: (value) => value.text.length === 0,
    })).toBe('skipped');
    expect(storage.values.has('draft')).toBe(true);

    storage.values.set('draft', JSON.stringify({ value: { text: 'old' } }));
    expect(persistDraft({ storage, storageKey: 'draft', value: null })).toBe('skipped');
    expect(storage.values.has('draft')).toBe(true);
  });

  it('keeps persistence failures contained', () => {
    const storage = {
      setItem: vi.fn(() => { throw new Error('quota'); }),
      removeItem: vi.fn(),
    };

    expect(persistDraft({ storage, storageKey: 'draft', value: { text: 'x' } })).toBe('failed');
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  it('flush listeners respond to app navigation and browser lifecycle events', () => {
    const target = new EventTarget();
    const flush = vi.fn();
    const removeListeners = addDraftFlushListeners(target, flush);

    dispatchDraftFlush(target);
    target.dispatchEvent(new Event('pagehide'));
    target.dispatchEvent(new Event('beforeunload'));
    expect(flush).toHaveBeenCalledTimes(3);

    removeListeners();
    dispatchDraftFlush(target);
    target.dispatchEvent(new Event('pagehide'));
    expect(flush).toHaveBeenCalledTimes(3);
  });
});
