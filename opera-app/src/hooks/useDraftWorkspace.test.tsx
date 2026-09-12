import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDraftWorkspace, type DraftWorkspace } from './useDraftWorkspace';
import { activeDraftKey, readDraftSession, type DraftValue } from '../lib/draftWorkspace';

afterEach(() => vi.unstubAllGlobals());
function setup(value: DraftValue) {
  const values = new Map<string, string>();
  let failPointer = false;
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, raw: string) => {
      if (failPointer && key === activeDraftKey('composer')) throw new Error('quota');
      values.set(key, raw);
    }),
    get length() { return values.size; }, key: (index: number) => [...values.keys()][index],
  };
  vi.stubGlobal('window', { localStorage });
  const session = readDraftSession('composer', { newDraft: true }, localStorage);
  let draft!: DraftWorkspace;
  function Probe() {
    draft = useDraftWorkspace(session, value);
    return null;
  }
  // Exercise the real hook's synchronous callbacks; SSR intentionally does not test effects/timers.
  renderToString(<Probe />);
  return { values, localStorage, draft, session, failPointer: (next: boolean) => { failPointer = next; } };
}
describe('draft workspace synchronous save callbacks', () => {
  it('retries failed indexes even if the text itself was saved', () => {
    const ctx = setup({ topic: 'test', result: null });
    ctx.failPointer(true);
    expect(ctx.draft.flush()).toBe(false);
    expect(JSON.parse(ctx.values.get(ctx.session.id)!).revision).toBe(1);
    ctx.failPointer(false);
    expect(ctx.draft.flush()).toBe(true);
    expect(ctx.values.get(activeDraftKey('composer'))).toBe(ctx.session.id);
    expect(JSON.parse(ctx.values.get(ctx.session.id)!).revision).toBe(2);
    expect(ctx.draft.flush()).toBe(true);
    expect(JSON.parse(ctx.values.get(ctx.session.id)!).revision).toBe(2);
  });
  it('detects deletion even when no local text has changed since the last save', () => {
    const ctx = setup({ topic: 'saved' });
    expect(ctx.draft.flush()).toBe(true);
    ctx.values.delete(ctx.session.id);
    expect(ctx.draft.flush()).toBe(false);
    expect(ctx.values.has(ctx.session.id)).toBe(false);
  });
  it('does not acknowledge quota failures or overwrite saved revisions', () => {
    const ctx = setup({ topic: 'test' });
    ctx.localStorage.setItem.mockImplementation(() => { throw new Error('quota'); });
    expect(ctx.draft.flush()).toBe(false);
    expect(ctx.values.has(ctx.session.id)).toBe(false);
  });
  it('checkpoints deep-copy content and keeps previous versions', () => {
    const value = { topic: 'before' };
    const ctx = setup(value);
    expect(ctx.draft.flush()).toBe(true);
    value.topic = 'after'; // Isolates the mutable ref writer, not React state/effect updates.
    expect(ctx.draft.checkpoint('edited')).toBe(true);
    const record = JSON.parse(ctx.values.get(ctx.session.id)!);
    expect(record.value.topic).toBe('after');
    expect(record.versions.map((v: { value: DraftValue }) => v.value.topic)).toEqual(['before', 'after']);
  });
});
