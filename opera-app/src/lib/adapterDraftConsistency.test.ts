import { describe, expect, it } from 'vitest';

import type { GenerationResult } from '../types';
import {
  createAdapterDraftParameterKey,
  createAdapterToneRegenerationSnapshot,
  selectCompatibleAdapterDraftResult,
} from './adapterDraftConsistency';

const completeResult: GenerationResult = {
  coverTitles: ['标题'],
  cards: [{ type: 'hook', content: '卡片' }],
  caption: '正文',
  tagGroups: [{ type: 'broad', label: '宽泛', tags: ['创作'] }],
};

function parameterKey(overrides: Partial<Parameters<typeof createAdapterDraftParameterKey>[0]> = {}) {
  return createAdapterDraftParameterKey({
    inputText: '同一篇原文',
    tone: 'knowledge',
    targetLength: 'medium',
    ...overrides,
  });
}

describe('adapter draft consistency', () => {
  it('keeps the last complete result while a same-parameter retry is interrupted', () => {
    const key = parameterKey();

    expect(selectCompatibleAdapterDraftResult(key, key, null, completeResult)).toBe(completeResult);
  });

  it.each([
    ['tone', { tone: 'casual' as const }],
    ['input text', { inputText: '已经修改的原文' }],
    ['target length', { targetLength: 'long' as const }],
  ])('drops an old result after the %s changes', (_label, overrides) => {
    expect(
      selectCompatibleAdapterDraftResult(parameterKey(overrides), parameterKey(), null, completeResult),
    ).toBeNull();
  });

  it('prefers the current completed result so user edits are persisted', () => {
    const key = parameterKey();
    const editedResult = { ...completeResult, caption: '用户编辑后的正文' };

    expect(
      selectCompatibleAdapterDraftResult(key, key, editedResult, completeResult),
    ).toBe(editedResult);
  });

  it('snapshots the latest user edits under the source tone before tone regeneration', () => {
    const editedResult: GenerationResult = {
      ...completeResult,
      cards: [{ type: 'hook', content: '用户编辑后的卡片' }],
      caption: '用户编辑后的正文',
      tagGroups: [{ type: 'broad', label: '宽泛', tags: ['用户标签'] }],
    };
    const parameters = {
      inputText: '同一篇原文',
      tone: 'knowledge' as const,
      targetLength: 'medium' as const,
    };

    const snapshot = createAdapterToneRegenerationSnapshot(parameters, editedResult, 'casual');
    editedResult.cards[0] = { type: 'hook', content: '后续流式覆盖' };
    editedResult.tagGroups[0].tags[0] = '后续覆盖';

    expect(snapshot.parameterKey).toBe(parameterKey());
    expect(snapshot.targetParameterKey).toBe(parameterKey({ tone: 'casual' }));
    expect(snapshot.result.caption).toBe('用户编辑后的正文');
    expect(snapshot.result.cards).toEqual([{ type: 'hook', content: '用户编辑后的卡片' }]);
    expect(snapshot.result.tagGroups[0].tags).toEqual(['用户标签']);
    expect(selectCompatibleAdapterDraftResult(
      snapshot.parameterKey,
      snapshot.parameterKey,
      null,
      snapshot.result,
    )).toBe(snapshot.result);
  });
});
