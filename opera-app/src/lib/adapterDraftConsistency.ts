import type { GenerationResult, TargetLength, ToneType } from '../types';

export interface AdapterDraftParameters {
  inputText: string;
  tone: ToneType | null;
  targetLength: TargetLength;
}

export interface AdapterToneRegenerationSnapshot {
  parameters: AdapterDraftParameters;
  parameterKey: string;
  targetParameterKey: string;
  result: GenerationResult;
}

/**
 * Stable identity for the user-visible parameters persisted with an adapter draft.
 * Exact input text is intentional: even whitespace edits can change model output.
 */
export function createAdapterDraftParameterKey(parameters: AdapterDraftParameters): string {
  return JSON.stringify([
    parameters.inputText,
    parameters.tone,
    parameters.targetLength,
  ]);
}

/**
 * Capture the user-edited completed result before a tone regeneration clears the UI.
 * The source and target keys keep the fallback from being persisted under the new tone.
 */
export function createAdapterToneRegenerationSnapshot(
  parameters: AdapterDraftParameters,
  result: GenerationResult,
  nextTone: ToneType,
): AdapterToneRegenerationSnapshot {
  const clonedResult: GenerationResult = {
    coverTitles: [...result.coverTitles],
    cards: result.cards.map((card) => typeof card === 'string' ? card : { ...card }),
    caption: result.caption,
    tagGroups: result.tagGroups.map((group) => ({
      ...group,
      tags: [...group.tags],
    })),
  };
  return {
    parameters: { ...parameters },
    parameterKey: createAdapterDraftParameterKey(parameters),
    targetParameterKey: createAdapterDraftParameterKey({ ...parameters, tone: nextTone }),
    result: clonedResult,
  };
}

/**
 * Keep a last complete result only while it still belongs to the current parameters.
 * The current completed result wins so post-generation edits remain autosaved.
 */
export function selectCompatibleAdapterDraftResult(
  currentParameterKey: string,
  completeParameterKey: string | null,
  currentCompleteResult: GenerationResult | null,
  lastCompleteResult: GenerationResult | null,
): GenerationResult | null {
  if (!completeParameterKey || currentParameterKey !== completeParameterKey) return null;
  return currentCompleteResult ?? lastCompleteResult;
}
