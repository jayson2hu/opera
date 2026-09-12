import type { SlideCard, SlideCardType, SlideCardValue } from '../types';

const VALID_CARD_TYPES = new Set<SlideCardType>([
  'hook',
  'insight',
  'method',
  'scenario',
  'summary',
]);

const LEGACY_CARD_TYPES: SlideCardType[] = [
  'hook',
  'insight',
  'insight',
  'method',
  'method',
  'scenario',
  'summary',
];

export function isSlideCard(value: unknown): value is SlideCard {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.type === 'string'
    && VALID_CARD_TYPES.has(candidate.type as SlideCardType)
    && typeof candidate.content === 'string'
    && candidate.content.trim().length > 0
  );
}

export function isSlideCardValue(value: unknown): value is SlideCardValue {
  return (typeof value === 'string' && value.trim().length > 0) || isSlideCard(value);
}

export function getSlideCardContent(card: SlideCardValue): string {
  return typeof card === 'string' ? card : card.content;
}

export function getSlideCardType(card: SlideCardValue, index: number): SlideCardType {
  if (typeof card !== 'string') return card.type;
  return LEGACY_CARD_TYPES[Math.min(index, LEGACY_CARD_TYPES.length - 1)] ?? 'summary';
}

export function updateSlideCardContent(card: SlideCardValue, content: string): SlideCardValue {
  return typeof card === 'string' ? content : { ...card, content };
}

export function normalizeSlideCards(value: unknown): SlideCardValue[] | null {
  if (!Array.isArray(value) || !value.every(isSlideCardValue)) return null;
  return value.map((card) => (
    typeof card === 'string'
      ? card.trim()
      : { type: card.type, content: card.content.trim() }
  ));
}

export interface ResolvedSlideCards {
  cards: SlideCardValue[];
  usedFallback: boolean;
}

/**
 * Prefer a newly received card payload, while keeping a previously validated
 * legacy payload when an optional cards_v2 event is malformed. Empty payloads
 * are not publishable card results and therefore cannot mask a protocol error.
 */
export function resolveSlideCardsPayload(
  value: unknown,
  fallback: SlideCardValue[] | null = null,
): ResolvedSlideCards | null {
  const preferred = normalizeSlideCards(value);
  if (preferred && preferred.length > 0) {
    return { cards: preferred, usedFallback: false };
  }

  const normalizedFallback = normalizeSlideCards(fallback);
  if (normalizedFallback && normalizedFallback.length > 0) {
    return { cards: normalizedFallback, usedFallback: true };
  }

  return null;
}
