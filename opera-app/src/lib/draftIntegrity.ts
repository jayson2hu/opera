import type { ComposerResult, GenerationResult, TagGroup, WeChatComposeResult } from '../types';
import { getSlideCardContent, isSlideCardValue } from './slideCards';

export type DraftResultStatus = 'complete' | 'incomplete';

interface DraftPayloadWithResult {
  result?: unknown;
  resultStatus?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isTagGroup(value: unknown): value is TagGroup {
  return (
    isRecord(value) &&
    (value.type === 'broad' || value.type === 'precise' || value.type === 'longtail') &&
    typeof value.label === 'string' &&
    isStringArray(value.tags)
  );
}

export function isGenerationResult(value: unknown): value is GenerationResult {
  return (
    isRecord(value) &&
    isStringArray(value.coverTitles) &&
    Array.isArray(value.cards) && value.cards.every(isSlideCardValue) &&
    typeof value.caption === 'string' &&
    Array.isArray(value.tagGroups) &&
    value.tagGroups.every(isTagGroup)
  );
}

export function isComposerResult(value: unknown): value is ComposerResult {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    isStringArray(value.tags) &&
    isStringArray(value.imageKeywords)
  );
}

export function isWeChatComposeResult(value: unknown): value is WeChatComposeResult {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    typeof value.digest === 'string' &&
    typeof value.body === 'string'
  );
}

function restoreCompleteResult<T>(
  payload: DraftPayloadWithResult,
  isResult: (value: unknown) => value is T,
  looksComplete: (value: T) => boolean,
): T | null {
  if (!isResult(payload.result)) return null;

  if (payload.resultStatus !== undefined) {
    return payload.resultStatus === 'complete' && looksComplete(payload.result)
      ? payload.result
      : null;
  }

  return looksComplete(payload.result) ? payload.result : null;
}

export function getRestorableGenerationResult(payload: DraftPayloadWithResult): GenerationResult | null {
  return restoreCompleteResult(
    payload,
    isGenerationResult,
    (result) =>
      result.coverTitles.some((title) => title.trim().length > 0) &&
      result.cards.some((card) => getSlideCardContent(card).trim().length > 0) &&
      result.caption.trim().length > 0 &&
      result.tagGroups.some((group) => group.tags.some((tag) => tag.trim().length > 0)),
  );
}

export function getRestorableComposerResult(payload: DraftPayloadWithResult): ComposerResult | null {
  return restoreCompleteResult(
    payload,
    isComposerResult,
    (result) =>
      result.title.trim().length > 0 &&
      result.body.trim().length > 0 &&
      result.tags.some((tag) => tag.trim().length > 0) &&
      result.imageKeywords.some((keyword) => keyword.trim().length > 0),
  );
}

export function getRestorableWeChatResult(payload: DraftPayloadWithResult): WeChatComposeResult | null {
  return restoreCompleteResult(
    payload,
    isWeChatComposeResult,
    (result) =>
      result.title.trim().length > 0 &&
      result.digest.trim().length > 0 &&
      result.body.trim().length > 0,
  );
}
