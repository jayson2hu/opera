import { describe, expect, it, vi } from 'vitest';
import { activeDraftKey, appendDraftVersion, readDraftSession, resultTargetLength, writeDraftRecord } from './draftWorkspace';
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
}
describe('versioned draft workspace', () => {
  it('reads legacy content twice without consuming a command or changing any stored byte', () => {
    const store = storage();
    const legacy = JSON.stringify({ value: { topic: '旧稿', result: { title: '', body: '用户修改的正文', tags: [], imageKeywords: [] } }, savedAt: '2026-09-10' });
    store.values.set('opera-draft-composer-current', legacy);
    const first = readDraftSession('composer', undefined, store);
    const second = readDraftSession('composer', undefined, store);
    expect(first.initialValue).toEqual(second.initialValue);
    expect(first.migratedFrom).toBe('opera-draft-composer-current');
    expect(store.setItem).not.toHaveBeenCalled();
    expect(writeDraftRecord(first, first.initialValue, [], 0, store).ok).toBe(true);
    expect(store.getItem('opera-draft-composer-current')).toBe(legacy);
    expect(store.getItem(activeDraftKey('composer'))).toBe(first.id);
  });
  it.each(['adapter', 'composer', 'wechat'] as const)('restores %s through normal entry and preserves blank new drafts', (flow) => {
    const store = storage(), first = readDraftSession(flow, undefined, store);
    const result = flow === 'composer' ? { title: '', body: 'partially edited', tags: [], imageKeywords: [] }
      : flow === 'wechat' ? { title: '', digest: '', body: 'partially edited' }
      : { coverTitles: [], cards: [], caption: 'partially edited', tagGroups: [] };
    const value = { topic: 'original', result };
    expect(writeDraftRecord(first, value, [], 0, store).ok).toBe(true);
    const restored = readDraftSession(flow, undefined, store);
    expect(restored.id).toBe(first.id); expect(restored.initialValue).toEqual(value);
    const blank = readDraftSession(flow, { newDraft: true }, store);
    expect(blank.id).not.toBe(first.id);
    expect(writeDraftRecord(blank, {}, [], 0, store).ok).toBe(true);
    expect(JSON.parse(store.getItem(first.id)!).value).toEqual(value);
    expect(JSON.parse(store.getItem(blank.id)!).value).toEqual({});
  });
  it('keeps changed configuration separate from stored content and provenance', () => {
    const store = storage(), session = readDraftSession('composer', undefined, store);
    const value = { tone: 'casual', model: 'removed-model', resultParameterKey: 'original-source', result: { title: '', body: 'keep', tags: [], imageKeywords: [] } };
    writeDraftRecord(session, value, [], 0, store);
    expect(readDraftSession('composer', undefined, store).initialValue).toEqual(value);
  });
  it('blocks corrupt records rather than overwriting them with empty state', () => {
    const store = storage(); store.values.set('opera-draft-wechat-current', '{broken');
    const session = readDraftSession('wechat', undefined, store);
    expect(session.readError).toBeTruthy();
    expect(writeDraftRecord(session, {}, [], 0, store).ok).toBe(false);
    expect(store.getItem('opera-draft-wechat-current')).toBe('{broken');
    expect(store.setItem).not.toHaveBeenCalled();
  });
  it('detects an already changed or deleted draft in another tab', () => {
    const store = storage(), first = readDraftSession('adapter', undefined, store);
    writeDraftRecord(first, { inputText: 'old' }, [], 0, store);
    const tabA = readDraftSession('adapter', undefined, store);
    const tabB = readDraftSession('adapter', undefined, store);
    writeDraftRecord(tabA, { inputText: 'newer' }, [], 1, store);
    expect(writeDraftRecord(tabB, { inputText: 'stale' }, [], 1, store).ok).toBe(false);
    expect(JSON.parse(store.getItem(first.id)!).value.inputText).toBe('newer');
    store.values.delete(first.id);
    expect(writeDraftRecord(tabA, { inputText: 'resurrect' }, [], 2, store).ok).toBe(false);
  });
  it('clones history, deduplicates identical snapshots and restores without removing history', () => {
    const value = { result: { title: '', digest: '', body: 'original' } };
    const history = appendDraftVersion([], value, 'initial');
    value.result.body = 'edited';
    expect(history[0].value.result).toEqual({ title: '', digest: '', body: 'original' });
    const next = appendDraftVersion(history, value, 'manual');
    expect(appendDraftVersion(next, value, 'duplicate')).toBe(next);
    const store = storage(), session = readDraftSession('wechat', undefined, store);
    writeDraftRecord(session, value, next, 0, store);
    const restored = readDraftSession('wechat', { id: session.id, payload: history[0].value, restoreVersion: true }, store);
    expect(restored.initialValue).toEqual(history[0].value);
    expect(restored.versions.slice(0, -1)).toEqual(next);
    expect(restored.versions.at(-1)?.label).toBe("恢复的历史版本");
  });
  it('keeps existing data on quota failures and reports a separately failed active pointer', () => {
    const store = storage(), session = readDraftSession('adapter', undefined, store);
    store.setItem.mockImplementation(() => { throw new Error('quota'); });
    expect(writeDraftRecord(session, { inputText: 'in memory' }, [], 0, store).ok).toBe(false);
    store.setItem.mockImplementation((key, value) => {
      if (key === activeDraftKey('adapter')) throw new Error('pointer quota');
      store.values.set(key, value);
    });
    expect(writeDraftRecord(session, { inputText: 'saved text' }, [], 0, store)).toMatchObject({ ok: true, pointerSaved: false });
    expect(JSON.parse(store.getItem(session.id)!).value.inputText).toBe('saved text');
  });
  it('uses generation-origin length rather than pending configuration', () => {
    expect(resultTargetLength(JSON.stringify(['composer-v1', 'topic', 'knowledge', 'casual', 'short', 'custom', 'model']), 'long')).toBe('short');
    expect(resultTargetLength(JSON.stringify(['source', 'knowledge', 'medium']), 'long')).toBe('medium');
    expect(resultTargetLength('invalid', 'short')).toBe('short');
  });
});

describe('migration and incompatible records', () => {
  it('does not resurrect a deleted migrated draft from legacy bytes', () => {
    const store = storage();
    const legacyId = 'opera-draft-composer-current';
    const raw = JSON.stringify({ value: { topic: 'legacy' }, savedAt: '2026-09-10' });
    store.values.set(legacyId, raw);
    const session = readDraftSession('composer', undefined, store);
    writeDraftRecord(session, session.initialValue, [], 0, store);
    expect(readDraftSession('composer', { id: legacyId }, store).id).toBe(session.id);
    store.values.delete(session.id); store.values.delete(activeDraftKey('composer'));
    expect(readDraftSession('composer', undefined, store).initialValue).toEqual({});
    expect(store.getItem(legacyId)).toBe(raw);
  });
  it('locks structurally incompatible content without discarding the original payload', () => {
    const store = storage();
    const original = { result: { body: 1234 }, topic: 'keep this' };
    const raw = JSON.stringify({ schemaVersion: 2, revision: 1, value: original, versions: [], savedAt: '2026-09-10' });
    store.values.set('opera-draft-wechat-current', raw);
    const session = readDraftSession('wechat', undefined, store);
    expect(session.readError).toContain('格式不兼容');
    expect(session.initialValue).toEqual(original);
    expect(writeDraftRecord(session, {}, [], 1, store).ok).toBe(false);
    expect(store.getItem('opera-draft-wechat-current')).toBe(raw);
  });
});
