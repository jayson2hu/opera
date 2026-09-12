import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GenerationResult,
  GenerationStep,
  ProviderSelectionProps,
  SlideCardType,
  SlideCardValue,
  TagGroup,
  TargetLength,
  ToneType,
} from '../types';
import { buildApiUrl, countChars, GENERATION_STEPS, TONE_OPTIONS } from '../constants';
import { createAdapterDraftParameterKey } from '../lib/adapterDraftConsistency';
import { downloadCardImage } from '../lib/cardImageExporter';
import { readPreferences } from '../lib/preferences';
import {
  getSlideCardContent,
  getSlideCardType,
  resolveSlideCardsPayload,
} from '../lib/slideCards';
import { rewriteParagraph } from '../lib/rewriteParagraph';
import {
  getRestorableGenerationResult,
  isGenerationResult,
} from '../lib/draftIntegrity';
import { streamSSE } from '../lib/sse';
import { toast } from '../lib/toast';
import ToneSelector from '../components/ToneSelector';
import ProviderSelector from '../components/ProviderSelector';
import ProgressIndicator from '../components/ProgressIndicator';
import CoverTitles from '../components/CoverTitles';
import CardExportMenu from '../components/adapter/CardExportMenu';
import SlideCardsOptimized from '../components/SlideCardsOptimized';
import Caption from '../components/Caption';
import HashtagGroups from '../components/HashtagGroups';
import ExtractionPointsPanel from '../components/ExtractionPointsPanel';
import SplitFlow from '../components/SplitFlow';
import TopicField from '../components/TopicField';
import BigBtn from '../components/shared/BigBtn';
import CfgGroup from '../components/shared/CfgGroup';
import OutputBar, { type OutputStatus } from '../components/shared/OutputBar';
import { useDraftWorkspace } from '../hooks/useDraftWorkspace';
import { readDraftSession, resultTargetLength, draftText, draftTone, draftLength, storedResultKey } from '../lib/draftWorkspace';
import DraftWorkspaceBar from '../components/shared/DraftWorkspaceBar';
import PublishChecklist from '../components/composer/PublishChecklist';
import GenerationReview from '../components/shared/GenerationReview';
import { canApplyCandidate, contentFingerprint, type GenerationCandidate } from '../lib/generationCandidate';

const MIN_INPUT_CHARS = 50;

const REWRITE_LENGTH_OPTIONS: Array<{ id: TargetLength; label: string; range: string }> = [
  { id: 'short', label: '精简', range: '300-500 字' },
  { id: 'medium', label: '标准', range: '600-900 字' },
  { id: 'long', label: '详细', range: '1000+ 字' },
];

const CARD_TYPE_LABELS: Record<SlideCardType, string> = {
  hook: '开头钩子', insight: '核心洞察', method: '方法论', scenario: '应用场景', summary: '行动总结',
};
const CARD_TYPE_ACCENTS: Record<SlideCardType, string> = {
  hook: '#ee8019', insight: '#8b5cf6', method: '#10b981', scenario: '#3b82f6', summary: '#f59e0b',
};

export default function AdapterPage({
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
  const [draftSession] = useState(() => readDraftSession('adapter', draftSelection));
  const initial = draftSession.initialValue;
  const initialResult = isGenerationResult(initial.result) ? initial.result : null;
  const [inputText, setInputText] = useState(() => draftText(initial.inputText));
  const [selectedTone, setSelectedTone] = useState<ToneType | null>(() => draftTone(initial.tone));
  const [targetLength, setTargetLength] = useState<TargetLength>(() => draftLength(initial.targetLength));
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<GenerationStep>(initialResult ? 'done' : 'extracting');
  const [result, setResult] = useState<GenerationResult | null>(initialResult);
  const [pendingCandidate, setPendingCandidate] = useState<GenerationCandidate<GenerationResult> | null>(null);
  const [lastCompleteParameterKey, setLastCompleteParameterKey] = useState<string | null>(() => initialResult
    ? storedResultKey(initial, createAdapterDraftParameterKey({ inputText, tone: selectedTone, targetLength })) : null);
  const [error, setError] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(Boolean(initialResult?.coverTitles.length));
  const [showCards, setShowCards] = useState(Boolean(initialResult?.cards.length));
  const [showCaption, setShowCaption] = useState(Boolean(initialResult));
  const [showTags, setShowTags] = useState(Boolean(initialResult?.tagGroups.length));
  const [selectedTitles, setSelectedTitles] = useState<Set<number>>(() => new Set());
  const [selectedCards, setSelectedCards] = useState<Set<number>>(() => new Set());
  const [copyActionDone, setCopyActionDone] = useState(false);
  const [extractedPoints, setExtractedPoints] = useState<string[]>([]);
  const [extractionParameterKey, setExtractionParameterKey] = useState<string | null>(null);

  const draftParameterKey = useMemo(
    () => createAdapterDraftParameterKey({ inputText, tone: selectedTone, targetLength }),
    [inputText, selectedTone, targetLength],
  );
  const currentDraftResult = getRestorableGenerationResult({ result, resultStatus: 'complete' });
  const draftResult = result;
  const workspace = useDraftWorkspace(draftSession, {
    inputText, tone: selectedTone, targetLength, provider: selectedProvider, model: selectedModel,
    result: draftResult, resultParameterKey: lastCompleteParameterKey,
    resultStatus: getRestorableGenerationResult({ result: draftResult, resultStatus: 'complete' }) ? 'complete' : 'incomplete',
  });
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputCharCount = countChars(inputText);
  const isInputReady = inputCharCount >= MIN_INPUT_CHARS;
  const canGenerate = isInputReady && selectedTone !== null && !isGenerating && !loading && !pendingCandidate;
  const selectedItemCount = selectedTitles.size + selectedCards.size;
  const isComplete = currentDraftResult !== null && currentStep === 'done';
  const isPausedForCurrentParameters = (
    currentStep === 'paused' && extractionParameterKey === draftParameterKey
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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const applyCandidate = () => {
    if (!pendingCandidate || !canApplyCandidate(pendingCandidate, result, draftSession.id)) return;
    if (!workspace.checkpoint('应用候选前原稿')) return;
    const next = pendingCandidate.value;
    setResult(next);
    setLastCompleteParameterKey(pendingCandidate.parameterKey);
    setPendingCandidate(null);
    setCurrentStep('done');
    setShowTitles(true); setShowCards(true); setShowCaption(true); setShowTags(true);
    setSelectedTitles(new Set()); setSelectedCards(new Set());
    setError(null);
  };

  const streamGeneration = useCallback(async (path: string, body: Record<string, unknown>, controller: AbortController, parameterKey: string) => {
    const original = result;
    const baseFingerprint = contentFingerprint(original);
    const partial: GenerationResult = { coverTitles: [], cards: [], caption: '', tagGroups: [] };
    let receivedTypedCards = false;
    await streamSSE(buildApiUrl(path), body, {
      signal: controller.signal, requireTerminal: true,
      isTerminalEvent: (event, data) => event === 'step' && (data?.step === 'done' || data?.step === 'paused'),
      onEvent: (event, data) => {
        if (controller.signal.aborted || abortRef.current !== controller) return;
        switch (event) {
          case 'step':
            if (data.step === 'done') {
              const completed = getRestorableGenerationResult({ result: partial, resultStatus: 'complete' });
              if (!completed) throw new Error('生成结果不完整，请重试');
              setPendingCandidate({ value: completed, original, baseFingerprint, parameterKey, draftId: draftSession.id });
              outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setCurrentStep(data.step as GenerationStep);
            if (data.step === 'done' || data.step === 'paused') setIsGenerating(false);
            break;
          case 'extraction_points':
            setExtractedPoints(Array.isArray(data.points) ? data.points : []);
            setExtractionParameterKey(parameterKey);
            setCurrentStep('paused');
            break;
          case 'titles': partial.coverTitles = data.coverTitles; break;
          case 'cards': {
            if (receivedTypedCards) break;
            const resolved = resolveSlideCardsPayload(data.cards);
            if (!resolved) throw new Error('卡片数据格式无效');
            partial.cards = resolved.cards; break;
          }
          case 'cards_v2': {
            const resolved = resolveSlideCardsPayload(data.cards, partial.cards);
            if (!resolved) throw new Error('卡片数据格式无效');
            if (resolved.usedFallback) break;
            receivedTypedCards = true; partial.cards = resolved.cards; break;
          }
          case 'caption': partial.caption = data.caption; break;
          case 'tags': partial.tagGroups = data.tagGroups as TagGroup[]; break;
          case 'error': throw new Error(data.error || 'Generation failed');
        }
      },
    });
  }, [result, draftSession.id]);

  const startGeneration = useCallback(async (points?: string[], toneOverride?: ToneType) => {
    const tone = toneOverride ?? selectedTone;
    if (!isInputReady || !tone || isGenerating || loading || pendingCandidate) return;
    if (!workspace.checkpoint('生成前原稿')) return;
    setIsGenerating(true); setCurrentStep(points ? 'titles' : 'extracting'); setError(null);
    if (!points) setExtractedPoints([]);
    setExtractionParameterKey(null);
    abortRef.current?.abort();
    const controller = new AbortController(); abortRef.current = controller;
    const parameterKey = createAdapterDraftParameterKey({ inputText, tone, targetLength });
    try {
      await streamGeneration(points ? '/api/generate/continue' : '/api/generate', {
        text: inputText, tone, targetLength, ...(points ? { points } : {}),
        ...(selectedProvider ? { provider: selectedProvider } : {}), ...(selectedModel ? { model: selectedModel } : {}),
      }, controller, parameterKey);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Unknown error'); setIsGenerating(false);
      setCurrentStep(result ? 'done' : 'extracting');
    }
  }, [inputText, isGenerating, isInputReady, loading, pendingCandidate, result, selectedModel, selectedProvider, selectedTone, streamGeneration, targetLength, workspace]);
  const handleGenerate = useCallback(() => startGeneration(), [startGeneration]);
  const handleContinueGeneration = useCallback((points: string[]) => startGeneration(points), [startGeneration]);
  const handleReset = useCallback(() => {
    abortRef.current?.abort(); abortRef.current = null;
    setIsGenerating(false); setCurrentStep(result ? 'done' : 'extracting');
    setExtractedPoints([]); setExtractionParameterKey(null); setError(null);
  }, [result]);

  const getAllText = useCallback((): string => {
    if (!result) return '';
    const sections: string[] = [];
    sections.push('封面标题');
    result.coverTitles.forEach((t, i) => sections.push(`${i + 1}. ${t}`));
    sections.push('\n图文卡片');
    result.cards.forEach((c, i) => sections.push(`--- 卡片 ${i + 1} ---\n${getSlideCardContent(c)}`));
    sections.push('\n正文');
    sections.push(result.caption);
    sections.push('\n标签');
    result.tagGroups.forEach((g) => sections.push(`${g.label}: ${g.tags.map((t) => `#${t}`).join(' ')}`));
    return sections.join('\n');
  }, [result]);

  const selectedText = useMemo(() => {
    if (!result) return '';
    const sections: string[] = [];
    const titles = result.coverTitles.filter((_, i) => selectedTitles.has(i));
    const cards = result.cards
      .filter((_, i) => selectedCards.has(i))
      .map(getSlideCardContent);
    if (titles.length > 0) sections.push(titles.join('\n---\n'));
    if (cards.length > 0) sections.push(cards.join('\n\n---\n\n'));
    return sections.join('\n\n---\n\n');
  }, [result, selectedCards, selectedTitles]);

  const exportCardIndices = useCallback(async (indices: number[]) => {
    if (!result || indices.length === 0) return;
    const validIndices = indices.filter((index) => index >= 0 && index < result.cards.length);
    const { showWatermark } = readPreferences();
    try {
      for (const index of validIndices) {
        const card = result.cards[index];
        if (!card) continue;
        const type = getSlideCardType(card, index);
        await downloadCardImage(
          { text: getSlideCardContent(card), index: index + 1, purpose: CARD_TYPE_LABELS[type] },
          {
            filename: `opera-card-${String(index + 1).padStart(2, '0')}.png`,
            accent: CARD_TYPE_ACCENTS[type],
            showWatermark,
          },
        );
      }
      toast(`已导出 ${validIndices.length} 张卡片`);
    } catch (exportError: unknown) {
      toast(exportError instanceof Error ? exportError.message : '卡片导出失败');
    }
  }, [result]);

  const exportSelectedCards = useCallback(
    () => exportCardIndices(Array.from(selectedCards).sort((a, b) => a - b)),
    [exportCardIndices, selectedCards],
  );
  const exportAllCards = useCallback(
    () => exportCardIndices(result ? result.cards.map((_, index) => index) : []),
    [exportCardIndices, result],
  );

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopyActionDone(true);
    window.setTimeout(() => setCopyActionDone(false), 1500);
    toast('已复制到剪贴板');
  }, []);

  const toggleTitleSelect = useCallback((index: number) => {
    setSelectedTitles((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleCardSelect = useCallback((index: number) => {
    setSelectedCards((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedTitles(new Set());
    setSelectedCards(new Set());
    setCopyActionDone(false);
  }, []);

  const handleToneRegenerate = (tone: ToneType) => {
    if (!canGenerate) return;
    setSelectedTone(tone);
    // Tone changes affect the candidate, never the retained original.
    void startGeneration(undefined, tone);
  };

  // BigBtn 四态文案
  const btnLabel = isGenerating
    ? currentStep === 'extracting'
      ? '提炼要点中…'
      : '改写中…'
    : isPausedForCurrentParameters
      ? '请先确认要点'
      : isComplete
        ? '重新改写'
        : '开始改写';

  const outputStatus: OutputStatus = error
    ? 'error'
    : isPausedForCurrentParameters
      ? 'paused'
      : isGenerating
        ? 'generating'
        : isComplete
          ? 'done'
          : 'idle';

  const left = (
    <div className="space-y-6">
      <CfgGroup step={1} title="公众号原文" tone="primary" hint={`≥ ${MIN_INPUT_CHARS} 字`}>
        <TopicField
          value={inputText}
          onChange={setInputText}
          disabled={isGenerating}
          multiline
          rows={6}
          minLen={MIN_INPUT_CHARS}
          tone="primary"
          placeholder="粘贴整篇公众号文章，建议保留标题、分段和关键案例"
        />
        <p className="text-[11px] leading-5 text-neutral-400">
          生成时，原文会发送到当前选择的模型服务；草稿仅保存在此浏览器。
        </p>
      </CfgGroup>

      <CfgGroup step={2} title="语气" tone="primary">
        <ToneSelector selected={selectedTone} onSelect={setSelectedTone} disabled={isGenerating} tone="primary" />
      </CfgGroup>

      <CfgGroup step={3} title="长度" tone="primary">
        <div className="grid grid-cols-3 gap-2">
          {REWRITE_LENGTH_OPTIONS.map((option) => {
            const isSelected = option.id === targetLength;
            return (
              <button
                key={option.id}
                type="button"
                disabled={isGenerating}
                onClick={() => setTargetLength(option.id)}
                aria-pressed={isSelected}
                className={`
                  flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-all cursor-pointer
                  ${isSelected ? 'border-primary-400 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-200 hover:bg-primary-50/40'}
                  ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}
                `}
              >
                <span className="text-sm font-semibold text-neutral-800">{option.label}</span>
                <span className="mt-0.5 text-[11px] text-primary-600">{option.range}</span>
              </button>
            );
          })}
        </div>
      </CfgGroup>

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
        <BigBtn
          onClick={() => void handleGenerate()}
          disabled={!canGenerate || isPausedForCurrentParameters}
          loading={isGenerating}
          tone="primary"
        >
          {btnLabel}
        </BigBtn>
        {isComplete && canGenerate && (
          <div className="space-y-2 border-t border-neutral-200 pt-3">
            <p className="text-xs font-semibold text-neutral-600">换个语气试试</p>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.filter((tone) => tone.id !== selectedTone).map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => handleToneRegenerate(tone.id)}
                  className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-left text-xs text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                >
                  <span className="block font-semibold">{tone.emoji} {tone.label}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-neutral-400">{tone.subtitle}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const right = (
    <div className="mx-auto max-w-4xl space-y-5">
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
            ? '左侧粘贴原文后开始'
            : outputStatus === 'paused'
              ? '请先在下方确认要点'
              : isComplete
                ? selectedItemCount > 0
                  ? `已选中 ${selectedItemCount} 个项目`
                  : '改写完成 · 可全选或单独复制'
                : undefined
        }
        actions={
          isComplete ? (
            <>
              <CardExportMenu
                selectedCount={selectedCards.size}
                totalCount={result?.cards.length ?? 0}
                onExportSelected={exportSelectedCards}
                onExportAll={exportAllCards}
              />
              {selectedItemCount > 0 && (
                <button
                  type="button"
                  onClick={clearSelections}
                  className="text-xs font-medium text-neutral-500 transition-colors hover:text-primary-600 cursor-pointer"
                >
                  取消全选
                </button>
              )}
              <button
                type="button"
                onClick={() => void copyText(selectedItemCount > 0 ? selectedText : getAllText())}
                className={`
                  inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer
                  ${copyActionDone
                    ? 'border-success-500/20 bg-success-50 text-success-500'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'}
                `}
              >
                {copyActionDone ? '已复制' : selectedItemCount > 0 ? `复制选中 (${selectedItemCount})` : '复制全部'}
              </button>
            </>
          ) : null
        }
      />

      {isPausedForCurrentParameters && extractedPoints.length > 0 && (
        <ExtractionPointsPanel
          points={extractedPoints}
          onConfirm={handleContinueGeneration}
          onCancel={handleReset}
        />
      )}

      {isGenerating && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <ProgressIndicator
            currentStep={currentStep}
            isGenerating={isGenerating}
            steps={GENERATION_STEPS}
            tone="primary"
          />
          <button type="button" onClick={handleReset} className="mt-3 text-xs text-neutral-600 underline">取消生成（保留原稿）</button>
        </section>
      )}

      {error && (
        <section className="rounded-2xl border border-error-500/20 bg-error-50 p-4 text-sm text-error-500">
          生成失败：{error}
        </section>
      )}

      {result && <PublishChecklist flow="adapter" targetLength={resultTargetLength(lastCompleteParameterKey, targetLength)} title={result.coverTitles[0] ?? ""} body={result.caption} />}
      {result ? (
        <div ref={outputRef} className="space-y-6">
          {showTitles && (
            <SectionCard accent="primary">
              <CoverTitles
                titles={result.coverTitles}
                selectedIndices={selectedTitles}
                onToggleSelect={toggleTitleSelect}
              />
            </SectionCard>
          )}
          {showCards && (
            <SectionCard accent="accent">
              <SlideCardsOptimized
                cards={result.cards}
                selectedIndices={selectedCards}
                onToggleSelect={toggleCardSelect}
                onChange={(cards: SlideCardValue[]) => setResult((current) => (current ? { ...current, cards } : current))}
              />
            </SectionCard>
          )}
          {showCaption && (
            <SectionCard accent="emerald">
              <Caption
                text={result.caption}
                tone="primary"
                onChange={(caption) => setResult((current) => current ? { ...current, caption } : current)}
                onBeforeChange={() => { workspace.checkpoint('正文编辑前'); }}
                disabled={false}
                onCustomEdit={handleParagraphRewrite}
              />
            </SectionCard>
          )}
          {showTags && (
            <SectionCard accent="amber">
              <HashtagGroups groups={result.tagGroups} />
            </SectionCard>
          )}
        </div>
      ) : (
        !isGenerating &&
        currentStep !== 'paused' && (
          <section className="rounded-paper border border-dashed border-neutral-300 bg-white px-8 py-16 text-center shadow-card">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
              <svg className="h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="mt-4 text-sm text-neutral-500">粘贴公众号文章后开始改写</p>
            <p className="mt-1 text-xs text-neutral-400">确认候选后可勾选标题/卡片选择性复制</p>
            <button type="button" onClick={() => { setResult({ coverTitles: [], cards: [], caption: "", tagGroups: [] }); setShowCaption(true); setCurrentStep("done"); }} className="mt-4 rounded-lg border border-primary-200 px-4 py-2 text-sm text-primary-700">不调用模型，直接写作</button>
          </section>
        )
      )}
    </div>
  );

  return <><div className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6">
    <DraftWorkspaceBar draft={workspace} onNew={onNewDraft} onRestore={onRestoreDraft}
      configurationChanged={Boolean(lastCompleteParameterKey && lastCompleteParameterKey !== draftParameterKey)} />
  </div><SplitFlow left={left} right={right} /></>;
}

interface SectionCardProps {
  accent: 'primary' | 'accent' | 'emerald' | 'amber';
  children: React.ReactNode;
}

const SECTION_ACCENT: Record<SectionCardProps['accent'], string> = {
  primary: 'from-primary-400 to-primary-500',
  accent: 'from-accent-400 to-accent-500',
  emerald: 'from-emerald-400 to-emerald-500',
  amber: 'from-amber-400 to-amber-500',
};

function SectionCard({ accent, children }: SectionCardProps) {
  return (
    <article className="overflow-hidden rounded-card border border-neutral-200 bg-white shadow-card">
      <div className={`h-0.5 w-full bg-gradient-to-r ${SECTION_ACCENT[accent]}`} />
      <div className="p-5 sm:p-6">{children}</div>
    </article>
  );
}
