import { WECHAT_DRAFT_STORAGE_KEY } from '../constants';
import type {
  TargetLength,
  ToneType,
  WeChatArticleType,
  WeChatDraftItem,
  WeChatDraftStatus,
} from '../types';
import {
  persistDraft,
  type DraftPersistResult,
  type DraftStorage,
} from './draftPersistence';

const ARTICLE_TYPES = new Set<WeChatArticleType>(['insight', 'guide', 'story', 'briefing']);
const TONES = new Set<ToneType>(['knowledge', 'casual', 'bff']);
const LENGTHS = new Set<TargetLength>(['short', 'medium', 'long']);
const STATUSES = new Set<WeChatDraftStatus>(['not_saved', 'queued']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDraft(value: unknown): WeChatDraftItem | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.topic !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.digest !== 'string' ||
    typeof value.body !== 'string' ||
    typeof value.savedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    topic: value.topic,
    title: value.title,
    digest: value.digest,
    body: value.body,
    articleType: ARTICLE_TYPES.has(value.articleType as WeChatArticleType)
      ? value.articleType as WeChatArticleType
      : 'guide',
    tone: TONES.has(value.tone as ToneType) ? value.tone as ToneType : 'knowledge',
    targetLength: LENGTHS.has(value.targetLength as TargetLength)
      ? value.targetLength as TargetLength
      : 'long',
    status: STATUSES.has(value.status as WeChatDraftStatus)
      ? value.status as WeChatDraftStatus
      : 'queued',
    savedAt: value.savedAt,
  };
}

/** Read both the legacy raw array and the safe persistDraft envelope. */
export function parseStoredWeChatDrafts(raw: string | null): WeChatDraftItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const values = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.value)
        ? parsed.value
        : [];
    return values.map(normalizeDraft).filter((draft): draft is WeChatDraftItem => draft !== null);
  } catch {
    return [];
  }
}

/** Persist manual WeChat drafts without allowing storage failures to escape. */
export function persistWeChatDrafts(
  storage: DraftStorage,
  drafts: WeChatDraftItem[],
  now?: () => string,
): DraftPersistResult {
  return persistDraft({
    storage,
    storageKey: WECHAT_DRAFT_STORAGE_KEY,
    value: drafts,
    isEmpty: (value) => value.length === 0,
    now,
  });
}
