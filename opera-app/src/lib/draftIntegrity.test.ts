import { describe, expect, it } from 'vitest';

import {
  getRestorableComposerResult,
  getRestorableGenerationResult,
  getRestorableWeChatResult,
} from './draftIntegrity';

const completeGenerationResult = {
  coverTitles: ['A complete title'],
  cards: ['A complete card'],
  caption: 'A complete caption',
  tagGroups: [{ type: 'broad' as const, label: 'Topic', tags: ['writing'] }],
};

const completeComposerResult = {
  title: 'A complete title',
  body: 'A complete body',
  tags: ['writing'],
  imageKeywords: ['desk'],
};

const completeWeChatResult = {
  title: 'A complete title',
  digest: 'A complete digest',
  body: 'A complete body',
};

describe('draft result integrity', () => {
  it('does not restore an incomplete generation snapshot as done', () => {
    expect(getRestorableGenerationResult({
      result: { ...completeGenerationResult, caption: '' },
      resultStatus: 'incomplete',
    })).toBeNull();
  });

  it('does not trust a complete marker when the generation content is still partial', () => {
    expect(getRestorableGenerationResult({
      result: { ...completeGenerationResult, cards: [] },
      resultStatus: 'complete',
    })).toBeNull();
  });

  it('does not trust a complete marker when composer content is still partial', () => {
    expect(getRestorableComposerResult({
      result: { ...completeComposerResult, body: '' },
      resultStatus: 'complete',
    })).toBeNull();
  });

  it('does not trust a complete marker when WeChat content is still partial', () => {
    expect(getRestorableWeChatResult({
      result: { ...completeWeChatResult, digest: '' },
      resultStatus: 'complete',
    })).toBeNull();
  });

  it('restores the last complete result unchanged after an interrupted retry', () => {
    expect(getRestorableGenerationResult({
      result: completeGenerationResult,
      resultStatus: 'complete',
    })).toBe(completeGenerationResult);
    expect(getRestorableComposerResult({
      result: completeComposerResult,
      resultStatus: 'complete',
    })).toBe(completeComposerResult);
    expect(getRestorableWeChatResult({
      result: completeWeChatResult,
      resultStatus: 'complete',
    })).toBe(completeWeChatResult);
  });

  it('conservatively supports complete legacy drafts without a status marker', () => {
    expect(getRestorableGenerationResult({ result: completeGenerationResult }))
      .toBe(completeGenerationResult);
    expect(getRestorableComposerResult({ result: completeComposerResult }))
      .toBe(completeComposerResult);
    expect(getRestorableWeChatResult({ result: completeWeChatResult }))
      .toBe(completeWeChatResult);
  });

  it('rejects incomplete legacy drafts without a status marker', () => {
    expect(getRestorableGenerationResult({
      result: { ...completeGenerationResult, coverTitles: [] },
    })).toBeNull();
    expect(getRestorableComposerResult({
      result: { ...completeComposerResult, tags: [] },
    })).toBeNull();
    expect(getRestorableWeChatResult({
      result: { ...completeWeChatResult, body: '   ' },
    })).toBeNull();
  });
});
