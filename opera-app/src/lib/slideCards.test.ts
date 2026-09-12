import { describe, expect, it } from 'vitest';

import {
  getSlideCardContent,
  getSlideCardType,
  normalizeSlideCards,
  resolveSlideCardsPayload,
  updateSlideCardContent,
} from './slideCards';

describe('slide card compatibility', () => {
  it('keeps structured cards and their semantic type', () => {
    const cards = normalizeSlideCards([
      { type: 'hook', content: ' Start with the tension ' },
      { type: 'summary', content: 'Close with one action' },
    ]);

    expect(cards).toEqual([
      { type: 'hook', content: 'Start with the tension' },
      { type: 'summary', content: 'Close with one action' },
    ]);
    expect(getSlideCardType(cards![1], 1)).toBe('summary');
  });

  it('falls back to the established index purposes for legacy strings', () => {
    const cards = normalizeSlideCards(['hook copy', 'insight copy', 'method copy']);

    expect(cards).toEqual(['hook copy', 'insight copy', 'method copy']);
    expect(getSlideCardType(cards![0], 0)).toBe('hook');
    expect(getSlideCardType(cards![2], 2)).toBe('insight');
  });

  it('updates object content without losing its purpose', () => {
    const updated = updateSlideCardContent(
      { type: 'method', content: 'old' },
      'new',
    );

    expect(updated).toEqual({ type: 'method', content: 'new' });
    expect(getSlideCardContent(updated)).toBe('new');
  });

  it('rejects malformed protocol values', () => {
    expect(normalizeSlideCards([{ type: 'unknown', content: 'copy' }])).toBeNull();
    expect(normalizeSlideCards([{ type: 'hook', content: '' }])).toBeNull();
    expect(normalizeSlideCards('not an array')).toBeNull();
  });

  it('keeps validated legacy cards when an optional cards_v2 payload is malformed', () => {
    const resolved = resolveSlideCardsPayload(
      [{ type: 'unknown', content: 'broken typed card' }],
      ['legacy hook', 'legacy insight'],
    );

    expect(resolved).toEqual({
      cards: ['legacy hook', 'legacy insight'],
      usedFallback: true,
    });
  });

  it('does not hide a card protocol error when neither payload is publishable', () => {
    expect(resolveSlideCardsPayload([], [])).toBeNull();
    expect(resolveSlideCardsPayload('invalid', null)).toBeNull();
  });
});
