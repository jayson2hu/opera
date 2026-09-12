import { describe, expect, it } from 'vitest';

import type { WeChatDraftItem } from '../types';
import { parseStoredWeChatDrafts, persistWeChatDrafts } from './weChatDraftStorage';

const draft: WeChatDraftItem = {
  id: 'draft-1',
  topic: '一个足够长的公众号选题',
  title: '完整标题',
  digest: '完整摘要',
  body: '完整正文',
  articleType: 'guide',
  tone: 'knowledge',
  targetLength: 'long',
  status: 'queued',
  savedAt: '2026-09-10T10:00:00.000Z',
};

describe('manual WeChat draft storage', () => {
  it('round-trips the safe persistence envelope', () => {
    let stored = '';
    const result = persistWeChatDrafts({
      setItem: (_key, value) => { stored = value; },
      removeItem: () => { stored = ''; },
    }, [draft], () => draft.savedAt);

    expect(result).toBe('saved');
    expect(parseStoredWeChatDrafts(stored)).toEqual([draft]);
  });

  it('keeps legacy raw-array drafts readable', () => {
    expect(parseStoredWeChatDrafts(JSON.stringify([draft]))).toEqual([draft]);
  });

  it('returns failed instead of reporting success when storage rejects the write', () => {
    expect(persistWeChatDrafts({
      setItem: () => { throw new Error('quota exceeded'); },
      removeItem: () => undefined,
    }, [draft])).toBe('failed');
  });
});
