import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAllDrafts, deleteDraft } from './useRecentDrafts';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const values = new Map<string, string>([
    ['opera-draft-composer-current', 'legacy'], ['opera-draft-composer-id', 'draft'],
    ['opera-active-draft-composer', 'opera-draft-composer-id'],
    ['opera-migrated-opera-draft-composer-current', 'opera-draft-composer-id'],
    ['opera.wechat.drafts', 'old manual draft box'],
    ['opera-draft-prefs', 'preferences'], ['opera-activity-composer', 'history'], ['unrelated', 'keep'],
  ]);
  const localStorage = { get length() { return values.size; }, key: (i: number) => [...values.keys()][i],
    getItem: (key: string) => values.get(key) ?? null, removeItem: vi.fn((key: string) => values.delete(key)) };
  vi.stubGlobal('window', { localStorage });
  return { values, localStorage };
}
describe('explicit draft deletion', () => {
  it('deletes only saved flow data and migration indexes when clearing all drafts', () => {
    const { values } = setup();
    expect(clearAllDrafts()).toBe(true);
    expect([...values.keys()]).toEqual(['opera-draft-prefs', 'opera-activity-composer', 'unrelated']);
  });
  it('never reports deletion success when storage rejects the operation', () => {
    const { values, localStorage } = setup();
    localStorage.removeItem.mockImplementation(() => { throw new Error('blocked'); });
    expect(deleteDraft('opera-draft-composer-id')).toBe(false);
    expect(clearAllDrafts()).toBe(false);
    expect(values.get('opera-draft-composer-id')).toBe('draft');
  });
  it('refuses non-draft keys', () => {
    const { localStorage } = setup();
    expect(deleteDraft('opera-draft-prefs')).toBe(false);
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
});
