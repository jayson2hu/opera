import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ComposerDraftImage,
  ComposerLayoutOptions,
  ComposerRegenerateTarget,
  ComposerRequest,
  ComposerResult,
  ComposerStep,
  ContentType,
  ProviderSelectionProps,
  TargetLength,
  ToneType,
} from '../types';
import { buildApiUrl, COMPOSER_STEPS, countChars } from '../constants';
import { downloadCardImage } from '../lib/cardImageExporter';
import { readPreferences } from '../lib/preferences';
import { rewriteParagraph } from '../lib/rewriteParagraph';
import {
  getRestorableComposerResult,
  isComposerResult,
} from '../lib/draftIntegrity';
import { createComposerDraftParameterKey, isProviderId } from '../lib/generationDraftConsistency';
import { streamSSE } from '../lib/sse';
import { toast } from '../lib/toast';
import ProgressIndicator from '../components/ProgressIndicator';
import ProviderSelector from '../components/ProviderSelector';
import SplitFlow from '../components/SplitFlow';
import ToneSelector from '../components/ToneSelector';
import TopicField from '../components/TopicField';
import ComposerLayoutPanel from '../components/composer/ComposerLayoutPanel';
import ContentTypeSelector from '../components/composer/ContentTypeSelector';
import BodyEditor from '../components/shared/BodyEditor';
import EditableTags from '../components/composer/EditableTags';
import EditableTitle from '../components/composer/EditableTitle';
import ImageSuggestion from '../components/composer/ImageSuggestion';
import LengthSelector from '../components/composer/LengthSelector';
import PhonePreview from '../components/composer/PhonePreview';
import TopicInspiration from '../components/composer/TopicInspiration';
import ConfigStepNav from '../components/composer/ConfigStepNav';
import PublishChecklist from '../components/composer/PublishChecklist';
import { formatComposerBody, formatComposerText } from '../components/composer/layoutFormatter';
import BigBtn from '../components/shared/BigBtn';
import CfgGroup from '../components/shared/CfgGroup';
import OutputBar, { type OutputStatus } from '../components/shared/OutputBar';
import { useDraftWorkspace } from '../hooks/useDraftWorkspace';
import { readDraftSession, resultTargetLength, draftText, draftTone, draftLength, storedResultKey, isDraftValue } from '../lib/draftWorkspace';
import DraftWorkspaceBar from '../components/shared/DraftWorkspaceBar';
import GenerationReview from '../components/shared/GenerationReview';
import { canApplyCandidate, contentFingerprint, contentRevision, resolveComposerCandidate, type GenerationCandidate } from '../lib/generationCandidate';

const MIN_TOPIC_CHARS = 10;
const MAX_DRAFT_IMAGES = 9;
const MAX_DRAFT_IMAGE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_DRAFT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const DEFAULT_LAYOUT_OPTIONS: ComposerLayoutOptions = {
  template: 'clean',
  useEmoji: true,
  useDividers: false,
  keepTagsAtEnd: true,
};
const EMPTY_RESULT: ComposerResult = { title: '', body: '', tags: [], imageKeywords: [] };
const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  recommend: '好物推荐',
  knowledge: '知识干货',
  story: '故事经历',
  tutorial: '教程清单',
};
const TONE_LABELS: Record<ToneType, string> = { knowledge: '干货专家', casual: '轻松聊天', bff: '闺蜜分享' };
const LENGTH_LABELS: Record<TargetLength, string> = { short: '精简', medium: '标准', long: '详细' };

function getComposeRequestError(status: number, errorMessage?: string) {
  if (status === 404) {
    return '未找到 /api/compose。请确认正在运行 FastAPI 后端。';
  }
  return errorMessage || `HTTP ${status}`;
}

export default function ComposerPage({
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
}: ProviderSelectionProps) {
  const [draftSession] = useState(() => readDraftSession('composer', draftSelection));
  const initial = draftSession.initialValue;
  const initialResult = isComposerResult(initial.result) ? initial.result : null;
  const [topic, setTopic] = useState(() => draftText(initial.topic));
  const [contentType, setContentType] = useState<ContentType | null>(() => ["recommend","knowledge","story","tutorial"].includes(String(initial.contentType)) ? initial.contentType as ContentType : null);
  const [selectedTone, setSelectedTone] = useState<ToneType | null>(() => draftTone(initial.tone));
  const [targetLength, setTargetLength] = useState<TargetLength>(() => draftLength(initial.targetLength, 'medium'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<ComposerStep>(initialResult ? 'done' : 'extracting');
  const [result, setResult] = useState<ComposerResult | null>(initialResult);
  const [pendingCandidate, setPendingCandidate] = useState<GenerationCandidate<ComposerResult> | null>(null);
  const [lastCompleteParameterKey, setLastCompleteParameterKey] = useState<string | null>(() => initialResult
    ? storedResultKey(initial, createComposerDraftParameterKey({ topic, contentType, tone: selectedTone, targetLength,
      provider: isProviderId(initial.provider) ? initial.provider : null, model: draftText(initial.model) })) : null);
  const [error, setError] = useState<string | null>(null);
  const [layoutOptions, setLayoutOptions] = useState<ComposerLayoutOptions>(() => {
    const saved = isDraftValue(initial.layoutOptions) ? initial.layoutOptions : {};
    return { ...DEFAULT_LAYOUT_OPTIONS,
      template: ["clean", "list", "story", "tutorial"].includes(String(saved.template)) ? saved.template as ComposerLayoutOptions["template"] : "clean",
      useEmoji: typeof saved.useEmoji === "boolean" ? saved.useEmoji : true,
      useDividers: typeof saved.useDividers === "boolean" ? saved.useDividers : false,
      keepTagsAtEnd: typeof saved.keepTagsAtEnd === "boolean" ? saved.keepTagsAtEnd : true };
  });
  const [draftImages, setDraftImages] = useState<ComposerDraftImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const draftParameterKey = useMemo(
    () => createComposerDraftParameterKey({
      topic,
      contentType,
      tone: selectedTone,
      targetLength,
      provider: selectedProvider,
      model: selectedModel,
    }),
    [contentType, selectedModel, selectedProvider, selectedTone, targetLength, topic],
  );
  const currentCompleteResult = currentStep === 'done'
    ? getRestorableComposerResult({ result, resultStatus: 'complete' })
    : null;
  // Persist user text independently of the next generation settings.
  const draftResult = result;
  const workspace = useDraftWorkspace(draftSession, {
    topic, contentType, tone: selectedTone, targetLength,
    provider: selectedProvider, model: selectedModel, result: draftResult,
    resultStatus: getRestorableComposerResult({ result: draftResult, resultStatus: 'complete' }) ? 'complete' : 'incomplete',
    resultParameterKey: lastCompleteParameterKey,
    layoutOptions,
  });
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const draftImagesRef = useRef<ComposerDraftImage[]>([]);
  const topicCharCount = countChars(topic);
  const isTopicReady = topicCharCount >= MIN_TOPIC_CHARS;
  const missingRequirements = [
    !isTopicReady ? '选题字数不足' : null,
    contentType === null ? '内容类型未选' : null,
    selectedTone === null ? '语气未选' : null,
  ].filter((item): item is string => item !== null);
  const canSubmitBase = missingRequirements.length === 0;
  const canGenerate = canSubmitBase && !isGenerating && !loading && !pendingCandidate;
  const hasAnyOutput =
    result !== null &&
    (result.title.trim().length > 0 ||
      result.body.trim().length > 0 ||
      result.tags.length > 0 ||
      result.imageKeywords.length > 0);
  const isComplete = currentCompleteResult !== null;
  const canRegenerate = Boolean(result?.body.trim()) && canSubmitBase && !isGenerating && !loading && !pendingCandidate;
  const baseConfigSteps = [
    { id: 'topic', title: '选题', done: isTopicReady, summary: topic.trim().slice(0, 20) || undefined },
    { id: 'content-type', title: '内容类型', done: contentType !== null, summary: contentType ? CONTENT_TYPE_LABELS[contentType] : undefined },
    { id: 'tone', title: '语气', done: selectedTone !== null, summary: selectedTone ? TONE_LABELS[selectedTone] : undefined },
    { id: 'length', title: '篇幅', done: true, summary: LENGTH_LABELS[targetLength] },
  ];
  const activeConfigStepId = baseConfigSteps.find((step) => !step.done)?.id ?? 'length';
  const configSteps = baseConfigSteps.map((step) => ({
    ...step,
    active: step.id === activeConfigStepId,
  }));
  const primaryShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘↵'
    : 'Ctrl↵';
  const scrollToConfigStep = (id: string) => {
    document.getElementById(`cfg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      draftImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  useEffect(() => {
    draftImagesRef.current = draftImages;
  }, [draftImages]);

  const applyCandidate = () => {
    if (!pendingCandidate || !canApplyCandidate(pendingCandidate, result, draftSession.id)) return;
    if (!workspace.checkpoint('应用候选前原稿')) return;
    setResult(pendingCandidate.value);
    setLastCompleteParameterKey(pendingCandidate.parameterKey);
    setPendingCandidate(null);
    setCurrentStep('done');
    setError(null);
  };
  const cancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setCurrentStep(result ? 'done' : 'extracting');
    setError(null);
  };

  const runCompose = useCallback(
    async (regenerate?: ComposerRegenerateTarget) => {
      if ((!regenerate && !canGenerate) || (regenerate && (!canRegenerate || !result))) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const generationParameterKey = draftParameterKey;

      if (!workspace.checkpoint('生成前原稿')) return;
      const original = result;
      const baseFingerprint = contentFingerprint(original);

      const partial: ComposerResult = regenerate ? { ...result! } : { ...EMPTY_RESULT };
      if (regenerate === 'title') partial.title = '';
      if (regenerate === 'body') partial.body = '';
      if (regenerate === 'tags') {
        partial.tags = [];
        partial.imageKeywords = [];
      }

      setIsGenerating(true);
      setCurrentStep('extracting');
      setError(null);
      // Accumulate streaming output separately; only explicit approval changes the draft.

      const payload: ComposerRequest = {
        topic,
        contentType: contentType!,
        tone: selectedTone!,
        targetLength,
        ...(selectedProvider ? { provider: selectedProvider } : {}),
        ...(selectedModel ? { model: selectedModel } : {}),
        ...(regenerate ? { regenerate, currentContent: { title: original?.title ?? '', body: original?.body ?? '',
          draftId: draftSession.id, revision: contentRevision(original) } } : {}),
      };

      try {
        let didScroll = false;
        await streamSSE(buildApiUrl('/api/compose'), payload, {
          signal: controller.signal,
          mapHttpError: (status, body) => getComposeRequestError(status, body.error),
          requireTerminal: true,
          isTerminalEvent: (event, data) => event === 'step' && data?.step === 'done',
          onEvent: (event, data) => {
            if (controller.signal.aborted || abortRef.current !== controller) return;
            switch (event) {
              case 'step': {
                if (data.step === 'done') {
                  const completedResult = resolveComposerCandidate({ ...partial }, regenerate);
                  if (!completedResult) throw new Error('生成结果不完整，请重试');
                  setPendingCandidate({ value: completedResult, original, baseFingerprint, draftId: draftSession.id,
                    parameterKey: regenerate && regenerate !== 'body' ? lastCompleteParameterKey ?? generationParameterKey : generationParameterKey });
                  setCurrentStep('done');
                  setIsGenerating(false);
                } else {
                  setCurrentStep(data.step as ComposerStep);
                }
                break;
              }
              case 'title':
                partial.title = data.title;
                // Candidate is held off-draft until the terminal event.
                break;
              case 'body':
                partial.body = data.body;
                // Candidate is held off-draft until the terminal event.
                break;
              case 'tags':
                partial.tags = data.tags;
                partial.imageKeywords = data.imageKeywords;
                // Candidate is held off-draft until the terminal event.
                break;
              case 'error':
                throw new Error(data.error || 'Compose failed');
            }
            if (!didScroll && (event === 'title' || event === 'body')) {
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
      canGenerate,
      canRegenerate,
      contentType,
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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.key === 'Enter' && !event.isComposing) {
        if (!canGenerate) return;
        event.preventDefault();
        void runCompose();

      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [canGenerate, runCompose]);

  const handleAddImages = useCallback((files: File[]) => {
    setDraftImages((current) => {
      const remaining = MAX_DRAFT_IMAGES - current.length;
      if (remaining <= 0) {
        setImageError(`最多 ${MAX_DRAFT_IMAGES} 张`);
        return current;
      }
      const accepted: ComposerDraftImage[] = [];
      let rejectedMessage: string | null = null;
      for (const file of files) {
        if (accepted.length >= remaining) {
          rejectedMessage = `最多 ${MAX_DRAFT_IMAGES} 张`;
          break;
        }
        if (!ACCEPTED_DRAFT_IMAGE_TYPES.has(file.type)) {
          rejectedMessage = '仅支持 PNG/JPG/WebP';
          continue;
        }
        if (file.size > MAX_DRAFT_IMAGE_SIZE) {
          rejectedMessage = '单张 ≤ 8 MB';
          continue;
        }
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2)}`;
        accepted.push({ id, file, name: file.name, previewUrl: URL.createObjectURL(file), alt: file.name });
      }
      setImageError(rejectedMessage);
      return accepted.length > 0 ? [...current, ...accepted] : current;
    });
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setDraftImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.id !== id);
    });
    setImageError(null);
  }, []);

  const handleMoveImage = useCallback((id: string, direction: 'left' | 'right') => {
    setDraftImages((current) => {
      const index = current.findIndex((image) => image.id === id);
      const nextIndex = direction === 'left' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
  }, []);

  const fullText = useMemo(
    () =>
      result
        ? formatComposerText({
            title: result.title,
            body: result.body,
            tags: result.tags,
            options: layoutOptions,
          })
        : '',
    [layoutOptions, result],
  );

  // 手机预览用的正文：按当前 layoutOptions.template 实时格式化
  const previewBody = useMemo(
    () => (result ? formatComposerBody(result.body, layoutOptions) : ''),
    [layoutOptions, result],
  );

  const handleCopy = useCallback(async () => {
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
    toast('已复制完整笔记');
  }, [fullText]);

  const handleExportSummary = useCallback(async () => {
    if (!result) return;
    const { showWatermark } = readPreferences();
    try {
      await downloadCardImage(
        { text: result.body, purpose: '正文摘录', index: 1 },
        {
          filename: 'opera-note-excerpt.png',
          heading: Array.from(result.title).slice(0, 18).join('') || '小红书原创笔记',
          accent: '#8b5cf6',
          showWatermark,
        },
      );
      toast('正文摘录图已导出');
    } catch (exportError: unknown) {
      toast(exportError instanceof Error ? exportError.message : '正文摘录图导出失败');
    }
  }, [result]);

  const outputStatus: OutputStatus = error
    ? 'error'
    : isGenerating
      ? 'generating'
      : isComplete
        ? 'done'
        : 'idle';

  // ─── 左栏：配置 ─────────────────────────────
  const left = (
    <div className="space-y-6">
      <ConfigStepNav steps={configSteps} disabled={isGenerating} onSelect={scrollToConfigStep} />

      <div id="cfg-topic" className="scroll-mt-24">
      <CfgGroup step={1} title="选题" tone="accent" hint={`≥ ${MIN_TOPIC_CHARS} 字`}>
        <TopicField
          value={topic}
          onChange={setTopic}
          disabled={isGenerating}
          multiline
          rows={2}
          minLen={MIN_TOPIC_CHARS}
          tone="accent"
          placeholder="例如：断奶第 7 天的真实感受"
        />
        <div className="mt-2">
          <TopicInspiration onPick={setTopic} disabled={isGenerating} />
        </div>
      </CfgGroup>
      </div>

      <div id="cfg-content-type" className="scroll-mt-24">
        <CfgGroup step={2} title="内容类型" tone="accent">
          <ContentTypeSelector selected={contentType} onSelect={setContentType} disabled={isGenerating} />
        </CfgGroup>
      </div>

      <div id="cfg-tone" className="scroll-mt-24">
        <CfgGroup step={3} title="语气" tone="accent">
          <ToneSelector selected={selectedTone} onSelect={setSelectedTone} disabled={isGenerating} tone="accent" />
        </CfgGroup>
      </div>

      <div id="cfg-length" className="scroll-mt-24">
        <CfgGroup step={4} title="篇幅" tone="accent">
          <LengthSelector selected={targetLength} onSelect={setTargetLength} disabled={isGenerating} />
        </CfgGroup>
      </div>

      <div className="space-y-3 border-t border-neutral-200 pt-5">
        <ProviderSelector
          providers={providers}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
          disabled={isGenerating}
          loading={loading}
        />
        <BigBtn onClick={() => void runCompose()} disabled={!canGenerate} loading={isGenerating} tone="accent">
          <span>{isGenerating ? '生成中…' : isComplete ? '重新生成' : '生成原创帖子'}</span>
          {!isGenerating && <kbd className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-medium text-white/80">{primaryShortcut}</kbd>}
        </BigBtn>
        <p className={`text-xs text-center ${canSubmitBase && !loading ? 'text-accent-600' : 'text-warning-600'}`}>
          {loading ? '模型配置加载中…' : canSubmitBase ? '准备就绪' : `还需要：${missingRequirements.join('、')}`}
        </p>
      </div>
    </div>
  );

  // ─── 右栏：编辑 + 预览（二列网格） ─────────────────────────────
  const right = (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_348px] items-start">
      {/* 中栏 · 编辑 */}
      <div className="space-y-5 min-w-0">
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
            pendingCandidate ? '候选待确认，当前稿件未变' : outputStatus === 'idle'
              ? '左侧填好后开始生成'
              : outputStatus === 'generating'
                ? '正在流式生成…'
                : outputStatus === 'done'
                  ? `${countChars(result?.body ?? '')} 字 · ${result?.tags.length ?? 0} 标签`
                  : undefined
          }
          actions={
            hasAnyOutput ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleExportSummary()}
                  className="inline-flex items-center gap-1 rounded-lg border border-accent-200 bg-white px-3 py-1.5 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-50 cursor-pointer"
                >
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3" />
                  </svg>
                  导出正文摘录
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-card transition-colors hover:bg-accent-600 cursor-pointer"
                >
                  复制全文
                </button>
              </div>
            ) : null
          }
        />

        {isGenerating && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <ProgressIndicator
              currentStep={currentStep}
              isGenerating={isGenerating}
              steps={COMPOSER_STEPS}
              tone="accent"
            />
            <button type="button" onClick={cancelGeneration} className="mt-3 text-xs text-neutral-600 underline">取消生成（保留原稿）</button>
          </section>
        )}

        {error && (
          <section className="rounded-2xl border border-error-500/20 bg-error-50 p-4 text-sm text-error-500">
            生成失败：{error}
          </section>
        )}

        {/* 排版结构条 */}
        {hasAnyOutput && (
          <ComposerLayoutPanel value={layoutOptions} onChange={setLayoutOptions} disabled={isGenerating} />
        )}

        {/* 笔记草稿卡（标题 + 正文 + 标签 + 配图） */}
        {result ? (
          <article ref={outputRef} className="overflow-hidden rounded-paper border border-neutral-200 bg-white shadow-paper">
            <div className="h-0.5 w-full bg-gradient-to-r from-accent-400 via-accent-500 to-primary-400" />
            <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                笔记草稿
                <span className="font-normal text-neutral-400">· 全文编辑 / 段落候选</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void runCompose()}
                  disabled={!canGenerate}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-accent-50 hover:text-accent-700 disabled:opacity-50 cursor-pointer"
                  aria-label="重写"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  重写
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-accent-50 hover:text-accent-700 cursor-pointer"
                  aria-label="复制"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  复制
                </button>
              </div>
            </header>

            <div className="px-5 py-5 sm:px-8 sm:py-7 space-y-4">
              <EditableTitle
                value={result.title}
                onBeforeChange={() => { workspace.checkpoint("标题编辑前"); }}
                onChange={(value) => setResult((current) => (current ? { ...current, title: value } : current))}
                onRegenerate={() => void runCompose('title')}
                canRegenerate={canRegenerate}
                disabled={isGenerating}
                tone="accent"
              />
              <BodyEditor value={result.body} tone="accent"
                onChange={(body) => setResult((current) => current ? { ...current, body } : current)}
                onBeforeChange={() => { workspace.checkpoint('正文编辑前'); }}
                onRewrite={handleParagraphRewrite} onRegenerate={() => void runCompose("body")}
                canRegenerate={canRegenerate} disabled={false} />
              {result && (
                <EditableTags
                  tags={result.tags}
                  onChange={(tags) => setResult((current) => (current ? { ...current, tags } : current))}
                  onRegenerate={() => void runCompose('tags')}
                  canRegenerate={canRegenerate}
                  disabled={isGenerating}
                />
              )}
            </div>
          </article>
        ) : !isGenerating ? (
          <section className="rounded-paper border border-dashed border-neutral-300 bg-white px-8 py-16 text-center shadow-card">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50 text-2xl">
              ✍️
            </div>
            <p className="mt-4 text-sm text-neutral-500">填写选题后生成一篇可编辑的小红书帖子</p>
            <p className="mt-1 text-xs text-neutral-400">实时手机预览在右侧</p>
            <button type="button" onClick={() => { setResult({ ...EMPTY_RESULT }); setCurrentStep("done"); }}
              className="mt-4 rounded-lg border border-accent-200 px-4 py-2 text-sm text-accent-700">不调用模型，直接写作</button>
          </section>
        ) : null}

        {result && (
          <PublishChecklist
            flow="composer" targetLength={resultTargetLength(lastCompleteParameterKey, targetLength)}
            title={result.title}
            body={result.body}
            tags={result.tags}
            imageCount={draftImages.length}
          />
        )}

        {hasAnyOutput && (
          <ImageSuggestion
            keywords={result?.imageKeywords ?? []}
            images={draftImages}
            onAddImages={handleAddImages}
            onRemoveImage={handleRemoveImage}
            onMoveImage={handleMoveImage}
            error={imageError}
            disabled={isGenerating}
          />
        )}
      </div>

      {/* 右栏 · 手机预览（宽屏 sticky，避免压缩编辑区） */}
      <div className="hidden 2xl:block">
        <div className="sticky top-4 flex justify-center">
          <PhonePreview
            title={result?.title ?? ''}
            body={previewBody}
            tags={result?.tags ?? []}
            images={draftImages}
            useEmoji={layoutOptions.useEmoji}
          />
        </div>
      </div>
    </div>
  );

  return <><div className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6">
    <DraftWorkspaceBar draft={workspace} onNew={onNewDraft} onRestore={onRestoreDraft}
      configurationChanged={Boolean(lastCompleteParameterKey && lastCompleteParameterKey !== draftParameterKey)} />
  </div><SplitFlow left={left} right={right} /></>;
}
