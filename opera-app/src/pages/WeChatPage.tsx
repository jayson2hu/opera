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
  WECHAT_ARTICLE_TYPE_OPTIONS,
  WECHAT_DRAFT_STORAGE_KEY,
  WECHAT_STEPS,
} from '../constants';
import { rewriteParagraph } from '../lib/rewriteParagraph';
import {
  getRestorableWeChatResult,
  isWeChatComposeResult,
} from '../lib/draftIntegrity';
import { createWeChatDraftParameterKey, isProviderId } from '../lib/generationDraftConsistency';
import { streamSSE } from '../lib/sse';
import { toast } from '../lib/toast';
import { parseStoredWeChatDrafts, persistWeChatDrafts } from '../lib/weChatDraftStorage';
import ProgressIndicator from '../components/ProgressIndicator';
import ProviderSelector from '../components/ProviderSelector';
import SplitFlow from '../components/SplitFlow';
import ToneSelector from '../components/ToneSelector';
import TopicField from '../components/TopicField';
import BodyEditor from '../components/shared/BodyEditor';
import { useDraftWorkspace } from '../hooks/useDraftWorkspace';
import { readDraftSession, resultTargetLength, draftText, draftTone, draftLength, storedResultKey } from '../lib/draftWorkspace';
import DraftWorkspaceBar from '../components/shared/DraftWorkspaceBar';
import PublishChecklist from '../components/composer/PublishChecklist';
import GenerationReview from '../components/shared/GenerationReview';
import { canApplyCandidate, contentFingerprint, contentRevision, resolveWeChatCandidate, type GenerationCandidate } from '../lib/generationCandidate';
import EditableTitle from '../components/composer/EditableTitle';
import LengthSelector from '../components/composer/LengthSelector';
import ArticleTypeSelector from '../components/wechat/ArticleTypeSelector';
import DraftBoxPanel from '../components/wechat/DraftBoxPanel';
import EditableDigest from '../components/wechat/EditableDigest';
import Paper from '../components/wechat/Paper';
import WeChatCover from '../components/wechat/WeChatCover';
import WeChatInlineImg from '../components/wechat/WeChatInlineImg';
import BigBtn from '../components/shared/BigBtn';
import CfgGroup from '../components/shared/CfgGroup';
import OutputBar, { type OutputStatus } from '../components/shared/OutputBar';

interface WeChatPageProps extends ProviderSelectionProps {
  onConvertToAdapter?: (text: string) => void;
}

const MIN_TOPIC_CHARS = 12;
const EMPTY_RESULT: WeChatComposeResult = { title: '', digest: '', body: '' };

const INLINE_IMG_CAPTIONS = ['清晨的一杯热茶', '飘落的银杏叶'];

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
    return parseStoredWeChatDrafts(window.localStorage.getItem(WECHAT_DRAFT_STORAGE_KEY));
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
  draftSelection,
  onNewDraft,
  onRestoreDraft,
  onConvertToAdapter,
}: WeChatPageProps) {
  const [draftSession] = useState(() => readDraftSession('wechat', draftSelection));
  const initial = draftSession.initialValue;
  const initialResult = isWeChatComposeResult(initial.result) ? initial.result : null;
  const [topic, setTopic] = useState(() => draftText(initial.topic));
  const [articleType, setArticleType] = useState<WeChatArticleType | null>(() => ["insight","guide","story","briefing"].includes(String(initial.articleType)) ? initial.articleType as WeChatArticleType : null);
  const [selectedTone, setSelectedTone] = useState<ToneType | null>(() => draftTone(initial.tone));
  const [targetLength, setTargetLength] = useState<TargetLength>(() => draftLength(initial.targetLength, 'long'));
  const [coverEnabled, setCoverEnabled] = useState(initial.coverEnabled !== false);
  const [inlineImagesEnabled, setInlineImagesEnabled] = useState(initial.inlineImagesEnabled !== false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<WeChatStep>(initialResult ? 'done' : 'extracting');
  const [result, setResult] = useState<WeChatComposeResult | null>(initialResult);
  const [pendingCandidate, setPendingCandidate] = useState<GenerationCandidate<WeChatComposeResult> | null>(null);
  const [lastCompleteParameterKey, setLastCompleteParameterKey] = useState<string | null>(() => initialResult
    ? storedResultKey(initial, createWeChatDraftParameterKey({ topic, articleType, tone: selectedTone, targetLength,
      provider: isProviderId(initial.provider) ? initial.provider : null, model: draftText(initial.model) })) : null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<WeChatDraftItem[]>(readStoredDrafts);
  const [draftStatus, setDraftStatus] = useState<WeChatDraftStatus>('not_saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const draftParameterKey = useMemo(
    () => createWeChatDraftParameterKey({
      topic,
      articleType,
      tone: selectedTone,
      targetLength,
      provider: selectedProvider,
      model: selectedModel,
    }),
    [articleType, selectedModel, selectedProvider, selectedTone, targetLength, topic],
  );
  const currentCompleteResult = currentStep === 'done'
    ? getRestorableWeChatResult({ result, resultStatus: 'complete' })
    : null;
  // Persist user text independently of the next generation settings.
  const draftResult = result;
  const isCurrentResultComplete = currentCompleteResult !== null;
  const workspace = useDraftWorkspace(draftSession, {
    topic, articleType, tone: selectedTone, targetLength,
    provider: selectedProvider, model: selectedModel, result: draftResult,
    resultStatus: getRestorableWeChatResult({ result: draftResult, resultStatus: 'complete' }) ? 'complete' : 'incomplete',
    resultParameterKey: lastCompleteParameterKey,
    coverEnabled, inlineImagesEnabled,
  });
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const topicCharCount = countChars(topic);
  const isTopicReady = topicCharCount >= MIN_TOPIC_CHARS;
  const missingRequirements = [
    !isTopicReady ? '选题字数不足' : null,
    articleType === null ? '文章类型未选' : null,
    selectedTone === null ? '语气未选' : null,
  ].filter((item): item is string => item !== null);
  const canSubmitBase = missingRequirements.length === 0;
  const canGenerate = canSubmitBase && !isGenerating && !loading && !pendingCandidate;
  const canRegenerate = Boolean(result?.body.trim()) && canSubmitBase && !isGenerating && !loading && !pendingCandidate;
  const savableResult = isCurrentResultComplete ? currentCompleteResult : null;
  const canSaveDraft = savableResult !== null && !isGenerating;
  const hasAnyOutput =
    result !== null &&
    (result.title.trim().length > 0 || result.digest.trim().length > 0 || result.body.trim().length > 0);
  const fullText = useMemo(
    () => (result ? [result.title.trim(), result.digest.trim(), result.body.trim()].filter(Boolean).join('\n\n') : ''),
    [result],
  );
  const bodyCharCount = countChars(result?.body ?? '');
  const paragraphCount = countParagraphs(result?.body ?? '');
  const articleTypeLabel = useMemo(
    () => WECHAT_ARTICLE_TYPE_OPTIONS.find((opt) => opt.id === articleType)?.label,
    [articleType],
  );
  const handleParagraphRewrite = useCallback(
    (instruction: string, text: string, signal?: AbortSignal) =>
      rewriteParagraph({
        text,
        instruction,
        signal,
        ...(selectedProvider ? { provider: selectedProvider } : {}),
        ...(selectedModel ? { model: selectedModel } : {}),
      }),
    [selectedModel, selectedProvider],
  );

  const outputStatus: OutputStatus = error
    ? 'error'
    : isGenerating
      ? 'generating'
      : hasAnyOutput
        ? 'done'
        : 'idle';

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const markDraftDirty = useCallback(() => {
    setDraftStatus('not_saved');
  }, []);

  const updateResult = useCallback(
    (updater: (current: WeChatComposeResult) => WeChatComposeResult) => {
      setResult((current) => updater(current ?? EMPTY_RESULT));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const applyCandidate = () => {
    if (!pendingCandidate || !canApplyCandidate(pendingCandidate, result, draftSession.id)) return;
    if (!workspace.checkpoint('应用候选前原稿')) return;
    setResult(pendingCandidate.value);
    setLastCompleteParameterKey(pendingCandidate.parameterKey);
    setPendingCandidate(null);
    setCurrentStep('done');
    setError(null);
    markDraftDirty();
  };
  const cancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setCurrentStep(result ? 'done' : 'extracting');
    setError(null);
  };

  const runCompose = useCallback(
    async (regenerate?: WeChatRegenerateTarget) => {
      if ((!regenerate && !canGenerate) || (regenerate && (!canRegenerate || !result))) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const generationParameterKey = draftParameterKey;

      if (!workspace.checkpoint('生成前原稿')) return;
      const original = result;
      const baseFingerprint = contentFingerprint(original);

      const partial: WeChatComposeResult = regenerate ? { ...result! } : { ...EMPTY_RESULT };
      if (regenerate === 'title') partial.title = '';
      if (regenerate === 'digest') partial.digest = '';
      if (regenerate === 'body') partial.body = '';

      setIsGenerating(true);
      setCurrentStep('extracting');
      setError(null);
      // Accumulate streaming output separately; only explicit approval changes the draft.
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
        ...(regenerate ? { regenerate, currentContent: { title: original?.title ?? '', body: original?.body ?? '',
          digest: original?.digest ?? '', draftId: draftSession.id, revision: contentRevision(original) } } : {}),
      };

      try {
        let didScroll = false;
        await streamSSE(buildApiUrl('/api/wechat/compose'), payload, {
          signal: controller.signal,
          mapHttpError: (status, body) => getComposeRequestError(status, body.error),
          requireTerminal: true,
          isTerminalEvent: (event, data) => event === 'step' && data?.step === 'done',
          onEvent: (event, data) => {
            if (controller.signal.aborted || abortRef.current !== controller) return;
            switch (event) {
              case 'step': {
                if (data.step === 'done') {
                  const completedResult = resolveWeChatCandidate({ ...partial }, regenerate);
                  if (!completedResult) throw new Error('生成结果不完整，请重试');
                  setPendingCandidate({ value: completedResult, original, baseFingerprint, draftId: draftSession.id,
                    parameterKey: regenerate && regenerate !== 'body' ? lastCompleteParameterKey ?? generationParameterKey : generationParameterKey });
                  setCurrentStep('done');
                  setIsGenerating(false);
                } else {
                  setCurrentStep(data.step as WeChatStep);
                }
                break;
              }
              case 'title':
                partial.title = data.title;
                // Candidate is held off-draft until the terminal event.
                break;
              case 'digest':
                partial.digest = data.digest;
                // Candidate is held off-draft until the terminal event.
                break;
              case 'body':
                partial.body = data.body;
                // Candidate is held off-draft until the terminal event.
                break;
              case 'error':
                throw new Error(data.error || 'Compose failed');
            }
            if (!didScroll && (event === 'title' || event === 'digest' || event === 'body')) {
              outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              didScroll = true;
            }
          },
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsGenerating(false);
      }
    },
    [
      articleType,
      canGenerate,
      canRegenerate,
      draftParameterKey,
      result,
      workspace,
      draftSession.id,
      lastCompleteParameterKey,
      selectedModel,
      selectedProvider,
      selectedTone,
      targetLength,
      topic,
    ],
  );

  const handleSaveDraft = useCallback(() => {
    if (!savableResult) return;
    const savedAt = new Date().toISOString();
    const nextId = activeDraftId ?? createDraftId();
    const nextDraft: WeChatDraftItem = {
      id: nextId,
      topic,
      title: savableResult.title.trim(),
      digest: savableResult.digest.trim(),
      body: savableResult.body.trim(),
      articleType: articleType ?? 'guide',
      tone: selectedTone ?? 'knowledge',
      targetLength,
      status: 'queued',
      savedAt,
    };
    const nextDrafts = [nextDraft, ...drafts.filter((draft) => draft.id !== nextId)];
    const persistResult: ReturnType<typeof persistWeChatDrafts> = (() => {
      try {
        return persistWeChatDrafts(window.localStorage, nextDrafts, () => savedAt);
      } catch {
        return 'failed';
      }
    })();
    if (persistResult !== 'saved') {
      setDraftStatus('not_saved');
      toast('草稿保存失败：浏览器存储不可用或空间不足');
      return;
    }

    setDrafts(nextDrafts);
    setDraftStatus('queued');
    setLastSavedAt(savedAt);
    setActiveDraftId(nextId);
    toast('已保存到本地草稿箱');
  }, [activeDraftId, articleType, drafts, savableResult, selectedTone, targetLength, topic]);

  const handleLoadDraft = useCallback((draft: WeChatDraftItem) => {
    const restoredResult = getRestorableWeChatResult({
      result: { title: draft.title, digest: draft.digest, body: draft.body },
      resultStatus: 'complete',
    });
    if (!restoredResult) {
      toast('该历史草稿内容不完整，无法作为完成稿恢复');
      return;
    }

    onRestoreDraft?.({ newDraft: true, payload: {
      topic: draft.topic, articleType: draft.articleType, tone: draft.tone, targetLength: draft.targetLength,
      result: restoredResult, resultStatus: "complete", provider: null, model: "",
    } });
  }, [onRestoreDraft]);
  const handleCopyAll = useCallback(async () => {
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast('已复制公众号草稿到剪贴板');
  }, [fullText]);

  const submitHint = isGenerating
    ? 'AI 正在撰写公众号文章…'
    : loading
      ? '模型配置加载中…'
    : canSubmitBase
      ? '准备就绪'
      : `还需要：${missingRequirements.join('、')}`;

  // ─── 左栏：配置 ─────────────────────────────
  const left = (
    <div className="space-y-6">
      <CfgGroup step={1} title="选题" tone="emerald" hint={`≥ ${MIN_TOPIC_CHARS} 字`}>
        <TopicField
          value={topic}
          onChange={setTopic}
          disabled={isGenerating}
          multiline
          rows={3}
          minLen={MIN_TOPIC_CHARS}
          tone="emerald"
          placeholder="例如：3 个让深度工作变成习惯的小切口"
        />
      </CfgGroup>

      <CfgGroup step={2} title="文章类型" tone="emerald">
        <ArticleTypeSelector selected={articleType} onSelect={setArticleType} disabled={isGenerating} />
      </CfgGroup>

      <CfgGroup step={3} title="语气" tone="emerald">
        <ToneSelector selected={selectedTone} onSelect={setSelectedTone} disabled={isGenerating} tone="emerald" />
      </CfgGroup>

      <CfgGroup step={4} title="篇幅" tone="emerald">
        <LengthSelector flow="wechat" selected={targetLength} onSelect={setTargetLength} disabled={isGenerating} />
      </CfgGroup>

      <CfgGroup step={5} title="配图" tone="emerald" hint="封面 + 正文">
        <div className="space-y-2">
          <ImageToggle label="封面头图" checked={coverEnabled} onChange={setCoverEnabled} disabled={isGenerating} />
          <ImageToggle label="正文配图" checked={inlineImagesEnabled} onChange={setInlineImagesEnabled} disabled={isGenerating} />
        </div>
      </CfgGroup>

      <div className="border-t border-neutral-200 pt-5 space-y-3">
        <ProviderSelector
          providers={providers}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
          disabled={isGenerating}
          loading={loading}
        />
        <BigBtn onClick={() => void runCompose()} disabled={!canGenerate} loading={isGenerating} tone="emerald">
          {isGenerating ? '生成中…' : '生成公众号草稿'}
        </BigBtn>
        <p className={`text-xs text-center ${isGenerating ? 'text-neutral-500' : canSubmitBase && !loading ? 'text-emerald-600' : 'text-warning-600'}`}>
          {submitHint}
        </p>
      </div>
    </div>
  );

  // ─── 右栏：输出 ─────────────────────────────
  const right = (
    <div className="mx-auto max-w-3xl space-y-5">
      {pendingCandidate && <GenerationReview original={pendingCandidate.original} candidate={pendingCandidate.value}
        stale={!canApplyCandidate(pendingCandidate, result, draftSession.id)} onApply={applyCandidate}
        onDiscard={() => setPendingCandidate(null)} />}
      {providerError && (
        <section className="rounded-2xl border border-warning-500/20 bg-warning-50 p-4 text-sm text-warning-500">
          模型服务加载失败：{providerError}
        </section>
      )}

      <OutputBar
        status={outputStatus}
        hint={
          pendingCandidate ? '候选待确认，当前稿件未变' : outputStatus === 'done'
            ? `${bodyCharCount} 字 · ${paragraphCount || 1} 段`
            : outputStatus === 'generating'
              ? '正在流式生成…'
              : outputStatus === 'idle'
                ? '左侧填好后开始生成'
                : undefined
        }
        actions={
          hasAnyOutput && !isGenerating ? (
            <>
              <button
                type="button"
                onClick={() => void handleCopyAll()}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
              >
                复制
              </button>
              {onConvertToAdapter && <button type="button" onClick={() => onConvertToAdapter(fullText)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600">转为小红书新稿</button>}
              {canSaveDraft && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-card transition-colors hover:bg-emerald-600 cursor-pointer"
                >
                  保存草稿
                </button>
              )}
            </>
          ) : null
        }
      />

      {isGenerating && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <ProgressIndicator currentStep={currentStep} isGenerating={isGenerating} steps={WECHAT_STEPS} tone="primary" />
          <button type="button" onClick={cancelGeneration} className="mt-3 text-xs text-neutral-600 underline">取消生成（保留原稿）</button>
        </section>
      )}

      {error && (
        <section className="rounded-2xl border border-error-500/20 bg-error-50 p-4 text-sm text-error-500">
          {error}
        </section>
      )}

      <div ref={outputRef}>
        {result && <PublishChecklist flow="wechat" targetLength={resultTargetLength(lastCompleteParameterKey, targetLength)} title={result.title} body={result.body} digest={result.digest} />}
      {result ? (
          <Paper
            articleTypeLabel={articleTypeLabel}
            charCount={bodyCharCount}
            titleNode={
              <EditableTitle
                value={result.title}
                onBeforeChange={() => { workspace.checkpoint("标题编辑前"); }}
                onChange={(value) => updateResult((current) => ({ ...current, title: value }))}
                onRegenerate={() => void runCompose('title')}
                canRegenerate={canRegenerate}
                disabled={isGenerating}
                label="标题"
                maxLength={32}
                tone="emerald"
              />
            }
          >
            {coverEnabled && <WeChatCover title={result.title} />}

            <EditableDigest
              value={result.digest}
              onBeforeChange={() => { workspace.checkpoint("摘要编辑前"); }}
              onChange={(value) => updateResult((current) => ({ ...current, digest: value }))}
              onRegenerate={() => void runCompose('digest')}
              canRegenerate={canRegenerate}
              disabled={isGenerating}
            />

            <BodyEditor value={result.body} tone="emerald"
              onChange={(body) => updateResult((current) => ({ ...current, body }))}
              onBeforeChange={() => { workspace.checkpoint('正文编辑前'); }}
              onRewrite={handleParagraphRewrite} onRegenerate={() => void runCompose("body")}
              canRegenerate={canRegenerate} disabled={false} />
            {inlineImagesEnabled && <div className="mt-5 space-y-4">
              <WeChatInlineImg caption={INLINE_IMG_CAPTIONS[0]} variant="gradient-a" />
              <WeChatInlineImg caption={INLINE_IMG_CAPTIONS[1]} variant="gradient-b" />
            </div>}
          </Paper>
        ) : !isGenerating ? (
          <section className="rounded-paper border border-dashed border-neutral-300 bg-white px-8 py-16 text-center shadow-card">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="mt-4 text-sm text-neutral-500">左侧填写选题、类型、语气和篇幅后开始生成</p>
            <p className="mt-1 text-xs text-neutral-400">完成后将在这里以公众号草稿样式呈现</p>
            <button type="button" onClick={() => { setResult({ ...EMPTY_RESULT }); setCurrentStep("done"); }}
              className="mt-4 rounded-lg border border-emerald-200 px-4 py-2 text-sm text-emerald-700">不调用模型，直接写作</button>
          </section>
        ) : null}
      </div>

      {drafts.length > 0 && (
        <DraftBoxPanel
          drafts={drafts}
          activeDraftId={activeDraftId}
          currentStatus={draftStatus}
          lastSavedAt={lastSavedAt}
          canSave={canSaveDraft}
          fullText={fullText}
          onSave={handleSaveDraft}
          onLoadDraft={handleLoadDraft}
          onConvertToAdapter={
            onConvertToAdapter && fullText.trim().length > 0 ? () => onConvertToAdapter(fullText) : undefined
          }
        />
      )}
    </div>
  );

  return <><div className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6">
    <DraftWorkspaceBar draft={workspace} onNew={onNewDraft} onRestore={onRestoreDraft}
      configurationChanged={Boolean(lastCompleteParameterKey && lastCompleteParameterKey !== draftParameterKey)} />
  </div><SplitFlow left={left} right={right} /></>;
}

interface ImageToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

function ImageToggle({ label, checked, onChange, disabled }: ImageToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={`
        flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm transition-all cursor-pointer
        ${checked ? 'border-emerald-300 bg-emerald-50/40 text-emerald-700' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      <span className="font-medium">{label}</span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-neutral-300'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-card transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  );
}
