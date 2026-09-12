import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useCreationDaysThisMonth as readCreationDaysThisMonth,
  useCreationStreak as readCreationStreak,
  useRecentDrafts as readRecentDrafts,
} from './useRecentDrafts';

// Exercise the browser snapshot callbacks rather than SSR's intentionally empty snapshot.
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

afterEach(() => vi.unstubAllGlobals());

describe('recent-draft browser storage boundary', () => {
  it('keeps the homepage statistics usable when the localStorage getter throws', () => {
    vi.stubGlobal('window', {
      get localStorage() { throw new DOMException('Storage is blocked', 'SecurityError'); },
    });

    expect(readRecentDrafts()).toEqual([]);
    expect(readCreationStreak()).toBe(0);
    expect(readCreationDaysThisMonth()).toEqual({ wechat: 0, adapter: 0, composer: 0 });
  });
});
