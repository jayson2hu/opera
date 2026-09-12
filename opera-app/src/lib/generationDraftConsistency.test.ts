import { describe, expect, it } from 'vitest';

import type { ComposerResult, WeChatComposeResult } from '../types';
import {
  createComposerDraftParameterKey,
  createWeChatDraftParameterKey,
  isDraftProviderSelectionAvailable,
  resolveRestoredDraftResult,
  selectCompatibleDraftResult,
} from './generationDraftConsistency';

const composerResult: ComposerResult = {
  title: '标题',
  body: '正文',
  tags: ['创作'],
  imageKeywords: ['书桌'],
};
const wechatResult: WeChatComposeResult = {
  title: '标题',
  digest: '摘要',
  body: '正文',
};

function composerKey(overrides: Partial<Parameters<typeof createComposerDraftParameterKey>[0]> = {}) {
  return createComposerDraftParameterKey({
    topic: '原始选题',
    contentType: 'knowledge',
    tone: 'knowledge',
    targetLength: 'medium',
    provider: 'deepseek',
    model: 'deepseek-chat',
    ...overrides,
  });
}

function wechatKey(overrides: Partial<Parameters<typeof createWeChatDraftParameterKey>[0]> = {}) {
  return createWeChatDraftParameterKey({
    topic: '原始公众号选题',
    articleType: 'guide',
    tone: 'knowledge',
    targetLength: 'long',
    provider: 'openai',
    model: 'gpt-5.2',
    ...overrides,
  });
}

describe('generation draft parameter identity', () => {
  it.each([
    ['topic', { topic: '新选题' }],
    ['content type', { contentType: 'story' as const }],
    ['tone', { tone: 'casual' as const }],
    ['length', { targetLength: 'short' as const }],
    ['provider', { provider: 'openai' as const }],
    ['model', { model: 'deepseek-reasoner' }],
  ])('drops a Composer result after the %s changes', (_label, overrides) => {
    expect(selectCompatibleDraftResult(
      composerKey(overrides),
      composerKey(),
      composerResult,
      composerResult,
    )).toBeNull();
  });

  it.each([
    ['topic', { topic: '新选题' }],
    ['article type', { articleType: 'story' as const }],
    ['tone', { tone: 'bff' as const }],
    ['length', { targetLength: 'medium' as const }],
    ['provider', { provider: 'anthropic' as const }],
    ['model', { model: 'gpt-5.2-chat-latest' }],
  ])('drops a WeChat result after the %s changes', (_label, overrides) => {
    expect(selectCompatibleDraftResult(
      wechatKey(overrides),
      wechatKey(),
      wechatResult,
      wechatResult,
    )).toBeNull();
  });

  it('keeps the last complete result during a same-parameter interrupted retry', () => {
    const key = composerKey();
    expect(selectCompatibleDraftResult(key, key, null, composerResult)).toBe(composerResult);
  });

  it('rejects a restore whose result identity belongs to older payload parameters', () => {
    expect(resolveRestoredDraftResult({
      result: composerResult,
      storedResultParameterKey: composerKey(),
      payloadParameterKey: composerKey({ topic: '自动保存后的新选题' }),
      currentParameterKey: composerKey({ topic: '自动保存后的新选题' }),
    })).toBeNull();
  });

  it('rejects a restore when the currently selected provider/model differs', () => {
    expect(resolveRestoredDraftResult({
      result: wechatResult,
      storedResultParameterKey: wechatKey(),
      payloadParameterKey: wechatKey(),
      currentParameterKey: wechatKey({ provider: 'deepseek', model: 'deepseek-chat' }),
    })).toBeNull();
  });

  it('restores matching legacy drafts that predate the identity field', () => {
    const key = composerKey();
    expect(resolveRestoredDraftResult({
      result: composerResult,
      storedResultParameterKey: undefined,
      payloadParameterKey: key,
      currentParameterKey: key,
    })).toEqual({ result: composerResult, parameterKey: key });
  });

  it('accepts only provider/model pairs still exposed by the app', () => {
    const providers = [
      { id: 'deepseek' as const, models: ['deepseek-chat'] },
      { id: 'openai' as const, models: ['gpt-5.2'] },
    ];

    expect(isDraftProviderSelectionAvailable(providers, 'deepseek', 'deepseek-chat')).toBe(true);
    expect(isDraftProviderSelectionAvailable(providers, 'deepseek', 'removed-model')).toBe(false);
    expect(isDraftProviderSelectionAvailable(providers, 'anthropic', 'claude-sonnet')).toBe(false);
    expect(isDraftProviderSelectionAvailable(providers, null, '')).toBe(true);
    expect(isDraftProviderSelectionAvailable(providers, null, 'orphan-model')).toBe(false);
  });
});
