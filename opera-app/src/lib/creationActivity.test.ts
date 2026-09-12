import { describe, expect, it } from 'vitest';

import { persistDraft } from './draftPersistence';
import {
  creationActivityStorageKey,
  flowKindFromDraftKey,
  mergeCreationActivities,
  readStoredDraftSavedAt,
  readCreationActivities,
  recordCreationActivity,
} from './creationActivity';

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    get length() {
      return values.size;
    },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('creation activity ledger', () => {
  it('adds one immutable key per local day and flow', () => {
    const storage = createStorage();
    const first = new Date(2026, 7, 30, 9);
    const laterSameDay = new Date(2026, 7, 30, 21);

    expect(recordCreationActivity({ storage, kind: 'adapter', at: first })).toBe('added');
    const key = creationActivityStorageKey('adapter', '2026-08-30');
    const originalValue = storage.getItem(key);
    expect(recordCreationActivity({ storage, kind: 'adapter', at: laterSameDay })).toBe('existing');
    expect(storage.getItem(key)).toBe(originalValue);

    expect(recordCreationActivity({ storage, kind: 'adapter', at: new Date(2026, 7, 31, 10) })).toBe('added');
    expect(recordCreationActivity({ storage, kind: 'wechat', at: new Date(2026, 7, 31, 11) })).toBe('added');
    expect(readCreationActivities(storage)).toEqual([
      { date: '2026-08-31', kind: 'adapter' },
      { date: '2026-08-31', kind: 'wechat' },
      { date: '2026-08-30', kind: 'adapter' },
    ]);
  });

  it('preserves a legacy current-draft day before the fixed key is overwritten', () => {
    const storage = createStorage();
    const draftStorageKey = 'opera-draft-adapter-current';

    expect(persistDraft({
      storage,
      storageKey: draftStorageKey,
      value: { inputText: 'old draft' },
      now: () => new Date(2026, 7, 29, 9).toISOString(),
    })).toBe('saved');
    const legacySavedAt = readStoredDraftSavedAt({ storage, draftStorageKey });

    expect(persistDraft({
      storage,
      storageKey: draftStorageKey,
      value: { inputText: 'new draft' },
      now: () => new Date(2026, 7, 31, 9).toISOString(),
    })).toBe('saved');
    expect(recordCreationActivity({ storage, kind: 'adapter', at: legacySavedAt ?? '' })).toBe('added');
    expect(recordCreationActivity({
      storage,
      kind: 'adapter',
      at: readStoredDraftSavedAt({ storage, draftStorageKey }) ?? '',
    })).toBe('added');

    expect(readCreationActivities(storage)).toEqual([
      { date: '2026-08-31', kind: 'adapter' },
      { date: '2026-08-29', kind: 'adapter' },
    ]);
  });

  it('merges unmigrated legacy draft dates without double counting ledger entries', () => {
    expect(mergeCreationActivities(
      [{ date: '2026-08-31', kind: 'composer' }],
      [
        { date: new Date(2026, 7, 31, 9).toISOString(), kind: 'composer' },
        { date: new Date(2026, 7, 30, 9).toISOString(), kind: 'wechat' },
      ],
    )).toEqual([
      { date: '2026-08-31', kind: 'composer' },
      { date: '2026-08-30', kind: 'wechat' },
    ]);
  });

  it('derives supported flows from current and fully-qualified draft keys', () => {
    expect(flowKindFromDraftKey('wechat-current')).toBe('wechat');
    expect(flowKindFromDraftKey('opera-draft-composer-current')).toBe('composer');
    expect(flowKindFromDraftKey('prefs')).toBeNull();
  });
});
