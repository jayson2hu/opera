import type { ComposerRegenerateTarget, ComposerResult, WeChatComposeResult, WeChatRegenerateTarget } from '../types';
import { getRestorableComposerResult, getRestorableWeChatResult, isComposerResult, isWeChatComposeResult } from './draftIntegrity';

export interface GenerationCandidate<T> {
  value: T;
  original: T | null;
  baseFingerprint: string;
  parameterKey: string;
  draftId: string;
}

/** Local rewrites validate only the requested block; manual neighboring fields may be unfinished. */
export function resolveComposerCandidate(value: unknown, target?: ComposerRegenerateTarget): ComposerResult | null {
  if (!target) return getRestorableComposerResult({ result: value, resultStatus: 'complete' });
  if (!isComposerResult(value)) return null;
  if (target === 'tags') return value.tags.length > 0 && value.imageKeywords.length > 0
    && [...value.tags, ...value.imageKeywords].every((item) => item.trim()) ? value : null;
  return value[target].trim() ? value : null;
}
export function resolveWeChatCandidate(value: unknown, target?: WeChatRegenerateTarget): WeChatComposeResult | null {
  if (!target) return getRestorableWeChatResult({ result: value, resultStatus: 'complete' });
  return isWeChatComposeResult(value) && value[target].trim() ? value : null;
}
export const contentFingerprint = (value: unknown): string => JSON.stringify(value);
export function canApplyCandidate<T>(candidate: GenerationCandidate<T>, current: T | null, draftId: string): boolean {
  return candidate.draftId === draftId && candidate.baseFingerprint === contentFingerprint(current);
}
/** Trace identifier only. Full-value comparison, not this hash, authorizes local application. */
export function contentRevision(value: unknown): string {
  const text = contentFingerprint(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return text.length + '-' + (hash >>> 0).toString(16);
}
export function candidateText(value: unknown): string {
  if (!value || typeof value !== 'object') return '（没有原稿）';
  const labels: Record<string, string> = { title: '标题', coverTitles: '封面标题', body: '正文', caption: '正文',
    digest: '摘要', cards: '图文卡片', tags: '标签', tagGroups: '标签分组', imageKeywords: '配图关键词' };
  return Object.entries(value).map(([key, item]) => {
    const text = typeof item === 'string' ? item : Array.isArray(item)
      ? item.map((part) => typeof part === 'string' ? part : typeof part?.content === 'string'
        ? part.content : typeof part?.label === 'string' && Array.isArray(part.tags)
          ? part.label + '：' + part.tags.join('、') : JSON.stringify(part)).join('\n\n') : JSON.stringify(item);
    return (labels[key] ?? key) + '\n' + text;
  }).join('\n\n');
}
