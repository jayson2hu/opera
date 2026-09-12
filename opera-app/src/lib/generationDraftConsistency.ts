import type {
  ContentType,
  ProviderId,
  ProviderInfo,
  TargetLength,
  ToneType,
  WeChatArticleType,
} from '../types';

interface SharedGenerationParameters {
  topic: string;
  tone: ToneType | null;
  targetLength: TargetLength;
  provider: ProviderId | null;
  model: string;
}

const PROVIDER_IDS: readonly ProviderId[] = [
  'anthropic',
  'anthropic_compat',
  'openai',
  'openai_compat',
  'deepseek',
  'custom',
];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && PROVIDER_IDS.includes(value as ProviderId);
}

export interface ComposerDraftParameters extends SharedGenerationParameters {
  contentType: ContentType | null;
}

export interface WeChatDraftParameters extends SharedGenerationParameters {
  articleType: WeChatArticleType | null;
}

export function createComposerDraftParameterKey(parameters: ComposerDraftParameters): string {
  return JSON.stringify([
    'composer-v1',
    parameters.topic,
    parameters.contentType,
    parameters.tone,
    parameters.targetLength,
    parameters.provider,
    parameters.model,
  ]);
}

export function createWeChatDraftParameterKey(parameters: WeChatDraftParameters): string {
  return JSON.stringify([
    'wechat-v1',
    parameters.topic,
    parameters.articleType,
    parameters.tone,
    parameters.targetLength,
    parameters.provider,
    parameters.model,
  ]);
}

/** Verify that a persisted provider/model pair can still be selected in the current app. */
export function isDraftProviderSelectionAvailable(
  providers: Pick<ProviderInfo, 'id' | 'models'>[],
  provider: ProviderId | null,
  model: string,
): boolean {
  if (provider === null) return model === '';
  const option = providers.find((candidate) => candidate.id === provider);
  return option !== undefined && (model === '' || option.models.includes(model));
}

/** Keep a completed result only while it still belongs to the current generation inputs. */
export function selectCompatibleDraftResult<T>(
  currentParameterKey: string,
  completeParameterKey: string | null,
  currentCompleteResult: T | null,
  lastCompleteResult: T | null,
): T | null {
  if (!completeParameterKey || currentParameterKey !== completeParameterKey) return null;
  return currentCompleteResult ?? lastCompleteResult;
}

export interface RestoredDraftResult<T> {
  result: T;
  parameterKey: string;
}

/**
 * Reject a stored result when either the payload fields or the currently selected
 * provider/model no longer match the identity captured with that result. Drafts
 * created before identities were added remain compatible when their payload and
 * current parameters agree.
 */
export function resolveRestoredDraftResult<T>({
  result,
  storedResultParameterKey,
  payloadParameterKey,
  currentParameterKey,
}: {
  result: T | null;
  storedResultParameterKey: unknown;
  payloadParameterKey: string;
  currentParameterKey: string;
}): RestoredDraftResult<T> | null {
  if (!result) return null;

  const resultParameterKey = typeof storedResultParameterKey === 'string'
    ? storedResultParameterKey
    : payloadParameterKey;
  if (
    resultParameterKey !== payloadParameterKey
    || resultParameterKey !== currentParameterKey
  ) {
    return null;
  }
  return { result, parameterKey: resultParameterKey };
}
