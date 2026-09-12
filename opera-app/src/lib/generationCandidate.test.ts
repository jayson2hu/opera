import { describe, expect, it } from 'vitest';
import { canApplyCandidate, candidateText, contentFingerprint, contentRevision, resolveComposerCandidate, resolveWeChatCandidate } from './generationCandidate';
describe('generation candidate boundary', () => {
  const original = { title: '用户标题', body: '人工正文', tags: ['咖啡'] };
  const candidate = { original, value: { ...original, body: '新候选' }, draftId: 'draft-a',
    parameterKey: 'origin', baseFingerprint: contentFingerprint(original) };
  it('allows explicit application only to the unchanged source draft', () => {
    expect(canApplyCandidate(candidate, original, 'draft-a')).toBe(true);
    expect(canApplyCandidate(candidate, { ...original, body: '等待期间手动修改' }, 'draft-a')).toBe(false);
    expect(canApplyCandidate(candidate, original, 'draft-b')).toBe(false);
    expect(canApplyCandidate(candidate, null, 'draft-a')).toBe(false);
  });
  it('keeps text equality separate from short trace identifiers', () => {
    expect(contentRevision(original)).toBe(contentRevision({ ...original }));
    expect(contentRevision(original)).not.toBe(contentRevision(candidate.value));
    expect(candidateText(original)).toContain('人工正文');
    expect(original.body).toBe('人工正文');
  });
});

describe('target-only candidate validation', () => {
  const composer = { title: '当前标题', body: '当前正文', tags: [], imageKeywords: [] };
  const wechat = { title: '', digest: '', body: '人工未完成稿件' };
  it('allows a valid generated block without requiring unrelated manual fields', () => {
    expect(resolveComposerCandidate(composer, 'title')).toEqual(composer);
    expect(resolveComposerCandidate(composer, 'body')).toEqual(composer);
    expect(resolveWeChatCandidate(wechat, 'body')).toEqual(wechat);
    expect(resolveWeChatCandidate({ ...wechat, digest: '新摘要' }, 'digest')).not.toBeNull();
  });
  it('rejects missing target output and incomplete full generations', () => {
    expect(resolveComposerCandidate(composer, 'tags')).toBeNull();
    expect(resolveComposerCandidate({ ...composer, body: ' ' }, 'body')).toBeNull();
    expect(resolveComposerCandidate(composer)).toBeNull();
    expect(resolveWeChatCandidate(wechat, 'title')).toBeNull();
    expect(resolveWeChatCandidate(wechat)).toBeNull();
  });
});
