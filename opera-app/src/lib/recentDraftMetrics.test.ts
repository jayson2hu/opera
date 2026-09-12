import { describe, expect, it } from 'vitest';

import {
  countCreationDaysThisMonth,
  deriveDraftProgress,
  getCreationStreak,
} from './recentDraftMetrics';

describe('recent draft metrics', () => {
  it('derives progress from complete, partial, and empty payloads', () => {
    expect(deriveDraftProgress({ resultStatus: 'complete' }).progress).toBe(100);
    expect(deriveDraftProgress({ resultStatus: 'incomplete', result: { body: 'partial' } }).progress).toBe(60);
    expect(deriveDraftProgress({ resultStatus: 'incomplete', result: null })).toEqual({
      progress: 25,
      statusLabel: '草稿阶段',
    });
    expect(deriveDraftProgress({ result: { caption: 'legacy result' } }).progress).toBe(100);
  });

  it('counts consecutive local calendar days from today', () => {
    const now = new Date(2026, 7, 31, 18, 0, 0);
    expect(getCreationStreak([
      new Date(2026, 7, 31, 9).toISOString(),
      new Date(2026, 7, 30, 23).toISOString(),
      new Date(2026, 7, 29, 12).toISOString(),
      new Date(2026, 7, 27, 12).toISOString(),
    ], now)).toBe(3);
    expect(getCreationStreak([new Date(2026, 7, 30, 23).toISOString()], now)).toBe(0);
  });

  it('counts unique activity days in the current local month by flow', () => {
    const counts = countCreationDaysThisMonth([
      { kind: 'adapter', date: '2026-08-01' },
      { kind: 'adapter', date: '2026-08-31' },
      { kind: 'adapter', date: '2026-08-31' },
      { kind: 'wechat', date: '2026-08-15' },
      { kind: 'composer', date: '2026-07-31' },
    ], new Date(2026, 7, 31, 18));

    expect(counts).toEqual({ wechat: 1, adapter: 2, composer: 0 });
  });
});
