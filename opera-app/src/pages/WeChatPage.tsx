import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ProviderSelectionProps,
  TargetLength,
  ToneType,
  WeChatArticleType,
  WeChatComposeRequest,
  WeChatComposeResult,
  WeChatDraftItem,
  WeChatDraftStatus,
  WeChatRegenerateTarget,
  WeChatStep,
} from '../types';
import {
  buildApiUrl,
  countChars,
  countParagraphs,
  WECHAT_DRAFT_STORAGE_KEY,
  WECHAT_STEPS,
} from '../constants';
import ProviderSelector from '../components/ProviderSelector';
import ProgressIndicator from '../components/ProgressIndicator';
import ToneSelector from '../components/ToneSelector';
import EditableBody from '../components/composer/EditableBody';
import EditableTitle from '../components/composer/EditableTitle';
import LengthSelector from '../components/composer/LengthSelector';
import TopicInput from '../components/composer/TopicInput';
import ArticleTypeSelector from '../components/wechat/ArticleTypeSelector';
import DraftBoxPanel from '../components/wechat/DraftBoxPanel';
import EditableDigest from '../components/wechat/EditableDigest';

interface WeChatPageProps extends ProviderSelectionProps {
  onConvertToAdapter?: (text: string) => void;
}

const MIN_TOPIC_CHARS = 12;
const MAX_DRAFT_COUNT = 6;
const EMPTY_RESULT: WeChatComposeResult = {
  title: '',
  digest: '',
  body: '',
};

function getComposeRequestError(status: number, errorMessage?: string) {
  if (status === 404) {
    return '未找到 /api/wechat/compose。请确认正在运行 FastAPI 后端 opera-server-py。';
  }

  return errorMessage || `HTTP ${status}`;
}

function createDraftId() {
  return globalThis.crypto?.randomUUID?.() ?? `wechat-${Date.now()}`;
}

function readStoredDrafts(): WeChatDraftItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(WECHAT_DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WeChatDraftItem =>
        typeof item?.id === 'string' &&
        typeof item?.topic === 'string' &&
        typeof item?.title === 'string' &&
        typeof item?.digest === 'string' &&
        typeof item?.body === 'string' &&
        typeof item?.savedAt === 'string',
    );
  } catch (error) {
    console.error('Failed to read local WeChat drafts', error);
    return [];
  }
}

export default function WeChatPage({
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  loading = false,
  error: providerError = null,
  onConvertToAdapter,
}: WeChatPageProps) {
  const [topic, setTopic] = useState('');
  const [articleType, setArticleType] = useState<WeChatArticleType | null>(null);
  const [selectedTone, setSelectedTone] = useState<ToneType | null>(null);
  const [targetLength, setTargetLength] = useState<TargetLength>('long');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<WeChatStep>('extracting');
  const [result, setResult] = useState<WeChatComposeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<WeChatDraftItem[]>([]);
  const [draftStatus, setDraftStatus] = useState<WeChatDraftStatus>('not_saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const topicCharCount = countChars(topic);
  const topicCharsRemaining = Math.max(0, MIN_TOPIC_CHARS - topicCharCount);
  const isTopicReady = topicCharCount >= MIN_TOPIC_CHARS;
  const missingRequirements = [
    !isTopicReady
      ? topicCharCount > 0
        ? `选题还差 ${topicCharsRemaining} 个字`
        : `请输入至少 ${MIN_TOPIC_CHARS} 个字的选题`
      : null,
    articleType === null ? '请选择文章类型' : null,
    selectedTone === null ? '请选择语气' : null,
  ].filter((item): item is string => item !== null);
  const canSubmitBase = missingRequirements.length === 0;
  const canGenerate = canSubmitBase && !isGenerating;
  const submitHint = isGenerating
    ? 'AI 正在撰写公众号文章，请稍候...'
    : canSubmitBase
      ? '准备就绪，可以开始生成。'
      : `还需要：${missingRequirements.join('、')}`;
  const hasAnyOutput =
    result !== null &&
    (result.title.trim().length > 0 || result.digest.trim().length > 0 || result.body.trim().length > 0);
  const fullText = useMemo(
    () => (result ? [result.title.trim(), result.digest.trim(), result.body.trim()].filter(Boolean).join('\n\n') : ''),
    [result],
  );
  const bodyCharCount = countChars(result?.body ?? '');
  const paragraphCount = countParagraphs(result?.body ?? '');

  useEffect(() => {
    queueMicrotask(() => {
      setDrafts(readStoredDrafts());
    });
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WECHAT_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts]);

  const markDraftDirty = useCallback(() => {
    setDraftStatus('not_saved');
  }, []);

  const updateResult = useCallback((updater: (current: WeChatComposeResult) => WeChatComposeResult) => {
    setResult((current) => updater(current ?? EMPTY_RESULT));
    markDraftDirty();
  }, [markDraftDirty]);

  const runCompose = useCallback(
    async (regenerate?: WeChatRegenerateTarget) => {
      if ((!regenerate && !canGenerate) || (regenerate && (!canSubmitBase || !result))) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const partial: WeChatComposeResult = regenerate ? { ...(result ?? EMPTY_RESULT) } : { ...EMPTY_RESULT };
      if (regenerate === 'title') partial.title = '';
      if (regenerate === 'digest') partial.digest = '';
      if (regenerate === 'body') partial.body = '';

      setIsGenerating(true);
      setCurrentStep('extracting');
      setError(null);
      setResult(partial);
      setDraftStatus('not_saved');
      setLastSavedAt(null);
      if (!regenerate) setActiveDraftId(null);

      const payload: WeChatComposeRequest = {
        topic,
        articleType: articleType!,
        tone: selectedTone!,
        targetLength,
        ...(selectedProvider ? { provider: selectedProvider } : {}),
        ...(selectedModel ? { model: selectedModel } : {}),
        ...(regenerate ? { regenerate } : {}),
      };

      try {
        const response = await fetch(buildApiUrl('/api/wechat/compose'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(getComposeRequestError(response.status, body.error));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let didScroll = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ') && eventType) {
              const data = JSON.parse(line.slice(6));

              switch (eventType) {
                case 'step':
                  setCurrentStep(data.step as WeChatStep);
                  if (data.step === 'done') setIsGenerating(false);
                  break;
                case 'title':
                  partial.title = data.title;
                  setResult({ ...partial });
                  break;
                case 'digest':
                  partial.digest = data.digest;
                  setResult({ ...partial });
                  break;
                case 'body':
                  partial.body = data.body;
                  setResult({ ...partial });
                  break;
                case 'error':
                  throw new Error(data.error || 'Compose failed');
              }

              if (!didScroll && (eventType === 'title' || eventType === 'digest' || eventType === 'body')) {
                outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                didScroll = true;
              }

              eventType = '';
            }
          }
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsGenerating(false);
      }
    },
    [
      articleType,
      canGenerate,
      canSubmitBase,
      result,
      selectedModel,
      selectedProvider,
      selectedTone,
      targetLength,
      topic,
    ],
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setCurrentStep('extracting');
    setResult(null);
    setError(null);
    setDraftStatus('not_saved');
    setLastSavedAt(null);
    setActiveDraftId(null);
  }, []);

  const handleSaveDraft = useCallback(() => {
    if (!result || !hasAnyOutput) return;

    const savedAt = new Date().toISOString();
    const nextId = activeDraftId ?? createDraftId();
    const nextDraft: WeChatDraftItem = {
      id: nextId,
      topic,
      title: result.title.trim(),
      digest: result.digest.trim(),
      body: result.body.trim(),
      articleType: articleType ?? 'guide',
      tone: selectedTone ?? 'knowledge',
      targetLength,
      status: 'queued',
      savedAt,
    };

    setDrafts((current) => [nextDraft, ...current.filter((draft) => draft.id !== nextId)].slice(0, MAX_DRAFT_COUNT));
    setDraftStatus('queued');
    setLastSavedAt(savedAt);
    setActiveDraftId(nextId);
  }, [activeDraftId, articleType, hasAnyOutput, result, selectedTone, targetLength, topic]);

  const handleLoadDraft = useCallback((draft: WeChatDraftItem) => {
    abortRef.current?.abort();
    setTopic(draft.topic);
    setArticleType(draft.articleType);
    setSelectedTone(draft.tone);
    setTargetLength(draft.targetLength);
    setResult({ title: draft.title, digest: draft.digest, body: draft.body });
    setCurrentStep('done');
    setDraftStatus(draft.status);
    setLastSavedAt(draft.savedAt);
    setActiveDraftId(draft.id);
    setError(null);
    setIsGenerating(false);
    outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-emerald-100 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(255,255,255,0.98))] p-8 sm:p-10 shadow-card">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr] lg:items-end">
          <div className="space-y-4">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              WeChat Draft Workspace
            </span>
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900">
                生成公众号标题、摘要和正文
              </h1>
              <p className="max-w-3xl text-sm sm:text-base leading-7 text-neutral-600">
                输入选题后，系统会按文章类型和语气生成完整公众号草稿。当前版本先保存到本地待同步草稿箱，不会直接发布到真实公众号。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '生成结构', value: '标题 + 摘要 + 正文' },
              { label: '正文输出', value: '流式生成' },
              { label: '草稿状态', value: draftStatus === 'queued' ? '待同步' : '未保存' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                <p className="text-xs text-neutral-400">{item.label}</p>
                <p className="mt-2 text-base font-semibold text-neutral-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {providerError && (
        <section className="rounded-2xl border border-warning-500/20 bg-warning-50 p-4 text-sm text-warning-500">
          模型服务加载失败：{providerError}
        </section>
      )}

      <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-card space-y-6">
        <TopicInput value={topic} onChange={setTopic} disabled={isGenerating} minChars={MIN_TOPIC_CHARS} />
        <ArticleTypeSelector selected={articleType} onSelect={setArticleType} disabled={isGenerating} />
        <ToneSelector selected={selectedTone} onSelect={setSelectedTone} disabled={isGenerating} />
        <LengthSelector selected={targetLength} onSelect={setTargetLength} disabled={isGenerating} />
        <ProviderSelector
          providers={providers}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
          disabled={isGenerating}
          loading={loading}
        />

        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void runCompose()}
              disabled={!canGenerate}
              className={canGenerate
                ? 'px-10 py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md shadow-emerald-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer'
                : 'px-10 py-3 rounded-2xl text-sm font-semibold bg-neutral-200 text-neutral-400 cursor-not-allowed'}
            >
              {isGenerating ? '生成中...' : '生成公众号草稿'}
            </button>

            {hasAnyOutput && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl text-sm font-medium text-neutral-500 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200 cursor-pointer"
              >
                清空结果
              </button>
            )}
          </div>

          <p className={`text-sm ${isGenerating ? 'text-neutral-500' : canSubmitBase ? 'text-emerald-600' : 'text-amber-600'}`}>
            {submitHint}
          </p>
        </div>
      </section>

      {(isGenerating || hasAnyOutput || error) && <div className="border-t border-neutral-200" />}

      {isGenerating && (
        <section>
          <ProgressIndicator currentStep={currentStep} isGenerating={isGenerating} steps={WECHAT_STEPS} tone="primary" />
        </section>
      )}

      {error && (
        <section className="rounded-2xl border border-error-500/20 bg-error-50 p-4 text-sm text-error-500">
          {error}
        </section>
      )}

      {hasAnyOutput && result && (
        <section ref={outputRef} className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr] items-start">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: '正文字数', value: `${bodyCharCount} 字` },
                { label: '正文段落', value: `${paragraphCount || 1} 段` },
                { label: '保存状态', value: draftStatus === 'queued' ? '已入草稿箱' : '未保存' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-card">
                  <p className="text-xs text-neutral-400">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-neutral-800">{item.value}</p>
                </div>
              ))}
            </div>

            <EditableTitle
              value={result.title}
              onChange={(value) => updateResult((current) => ({ ...current, title: value }))}
              onRegenerate={() => void runCompose('title')}
              canRegenerate={canSubmitBase}
              disabled={isGenerating}
              label="标题"
              maxLength={36}
              tone="primary"
            />
            <EditableDigest
              value={result.digest}
              onChange={(value) => updateResult((current) => ({ ...current, digest: value }))}
              onRegenerate={() => void runCompose('digest')}
              canRegenerate={canSubmitBase}
              disabled={isGenerating}
            />
            <EditableBody
              value={result.body}
              onChange={(value) => updateResult((current) => ({ ...current, body: value }))}
              onRegenerate={() => void runCompose('body')}
              canRegenerate={canSubmitBase}
              disabled={isGenerating}
              tone="primary"
            />
          </div>

          <DraftBoxPanel
            drafts={drafts}
            activeDraftId={activeDraftId}
            currentStatus={draftStatus}
            lastSavedAt={lastSavedAt}
            canSave={hasAnyOutput && !isGenerating}
            fullText={fullText}
            onSave={handleSaveDraft}
            onLoadDraft={handleLoadDraft}
            onConvertToAdapter={
              onConvertToAdapter && fullText.trim().length > 0
                ? () => onConvertToAdapter(fullText)
                : undefined
            }
          />
        </section>
      )}
    </main>
  );
}
