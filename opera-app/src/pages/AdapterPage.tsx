import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GenerationResult,
  GenerationStep,
  ProviderSelectionProps,
  TagGroup,
  TargetLength,
  ToneType,
} from '../types';
import { buildApiUrl, GENERATION_STEPS } from '../constants';
import TextInput from '../components/TextInput';
import ToneSelector from '../components/ToneSelector';
import ProviderSelector from '../components/ProviderSelector';
import ProgressIndicator from '../components/ProgressIndicator';
import CoverTitles from '../components/CoverTitles';
import SlideCards from '../components/SlideCards';
import Caption from '../components/Caption';
import HashtagGroups from '../components/HashtagGroups';
import CopyButton from '../components/CopyButton';
import UsageGuide from '../components/UsageGuide';

interface AdapterPageProps extends ProviderSelectionProps {
  pendingText?: string;
  onPendingTextConsumed?: () => void;
}

const REWRITE_LENGTH_OPTIONS: Array<{
  id: TargetLength;
  label: string;
  range: string;
  description: string;
}> = [
  { id: 'short', label: '精简版', range: '300-500 字', description: '适合快速发布，保留核心卖点和行动建议。' },
  { id: 'medium', label: '标准版', range: '600-900 字', description: '兼顾信息密度和阅读节奏，适合多数笔记。' },
  { id: 'long', label: '详细版', range: '1000-1500 字', description: '适合深度拆解、教程和完整经验复盘。' },
];

export default function AdapterPage({
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  loading = false,
  error: providerError = null,
  pendingText = '',
  onPendingTextConsumed,
}: AdapterPageProps) {
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState<ToneType | null>(null);
  const [targetLength, setTargetLength] = useState<TargetLength>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<GenerationStep>('extracting');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const canGenerate = inputText.trim().length > 0 && selectedTone !== null && !isGenerating;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const nextText = pendingText.trim();
    if (!nextText) return;
    setInputText(nextText);
    setSelectedTone('knowledge');
    setResult(null);
    setError(null);
    setShowTitles(false);
    setShowCards(false);
    setShowCaption(false);
    setShowTags(false);
    onPendingTextConsumed?.();
  }, [onPendingTextConsumed, pendingText]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setCurrentStep('extracting');
    setResult(null);
    setError(null);
    setShowTitles(false);
    setShowCards(false);
    setShowCaption(false);
    setShowTags(false);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const partial: GenerationResult = {
      coverTitles: [],
      cards: [],
      caption: '',
      tagGroups: [],
    };

    try {
      const response = await fetch(buildApiUrl('/api/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          tone: selectedTone,
          targetLength,
          ...(selectedProvider ? { provider: selectedProvider } : {}),
          ...(selectedModel ? { model: selectedModel } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

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
                setCurrentStep(data.step as GenerationStep);
                if (data.step === 'done') setIsGenerating(false);
                break;
              case 'titles':
                partial.coverTitles = data.coverTitles;
                setResult({ ...partial });
                setShowTitles(true);
                outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                break;
              case 'cards':
                partial.cards = data.cards;
                setResult({ ...partial });
                setShowCards(true);
                break;
              case 'caption':
                partial.caption = data.caption;
                setResult({ ...partial });
                setShowCaption(true);
                break;
              case 'tags':
                partial.tagGroups = data.tagGroups as TagGroup[];
                setResult({ ...partial });
                setShowTags(true);
                break;
              case 'error':
                throw new Error(data.error || 'Generation failed');
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
  }, [canGenerate, inputText, selectedTone, targetLength, selectedProvider, selectedModel]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setCurrentStep('extracting');
    setResult(null);
    setError(null);
    setShowTitles(false);
    setShowCards(false);
    setShowCaption(false);
    setShowTags(false);
  }, []);

  const handleRewriteAnother = useCallback(() => {
    handleReset();
    setInputText('');
    setSelectedTone(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [handleReset]);

  const getAllText = (): string => {
    if (!result) return '';

    const sections: string[] = [];
    sections.push('封面标题');
    result.coverTitles.forEach((title, index) => sections.push(`${index + 1}. ${title}`));
    sections.push('\n图文卡片');
    result.cards.forEach((card, index) => sections.push(`--- 卡片 ${index + 1} ---\n${card}`));
    sections.push('\n正文');
    sections.push(result.caption);
    sections.push('\n标签');
    result.tagGroups.forEach((group) => {
      sections.push(`${group.label}: ${group.tags.map((tag) => `#${tag}`).join(' ')}`);
    });
    return sections.join('\n');
  };

  const isComplete = result !== null && currentStep === 'done';

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <section className="space-y-6">
        <div className="rounded-[32px] border border-primary-100 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(135deg,_rgba(239,246,255,0.98),_rgba(255,255,255,0.98))] p-8 sm:p-10 shadow-card">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-4">
            公众号内容转小红书笔记
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 max-w-3xl leading-7">
            粘贴长文或公众号文章，生成封面标题、图文卡片、正文和标签，适合快速整理成可发布的小红书内容。
          </p>
        </div>

        {providerError && (
          <section className="p-4 bg-warning-50 border border-warning-500/20 rounded-xl text-sm text-warning-500">
            模型服务加载失败：{providerError}
          </section>
        )}

        <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-card space-y-6">
          <TextInput value={inputText} onChange={setInputText} disabled={isGenerating} />
          <UsageGuide />

          <ToneSelector selected={selectedTone} onSelect={setSelectedTone} disabled={isGenerating} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-800">内容长度</h2>
                <p className="text-xs text-neutral-400 mt-0.5">选择生成笔记的详细程度。</p>
              </div>
              <span className="text-xs text-neutral-400">
                当前 {REWRITE_LENGTH_OPTIONS.find((option) => option.id === targetLength)?.range}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {REWRITE_LENGTH_OPTIONS.map((option) => {
                const isSelected = option.id === targetLength;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setTargetLength(option.id)}
                    className={`
                      text-left rounded-xl border px-4 py-3 transition-all cursor-pointer
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                      ${
                        isSelected
                          ? 'border-primary-400 bg-primary-50 shadow-sm shadow-primary-500/10'
                          : 'border-neutral-200 bg-white hover:border-primary-200 hover:bg-primary-50/40'
                      }
                      ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}
                    `}
                    aria-pressed={isSelected}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-800">{option.label}</span>
                      <span className="text-xs font-medium text-primary-600">{option.range}</span>
                    </span>
                    <span className="block text-xs text-neutral-500 mt-1.5 leading-relaxed">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <ProviderSelector
            providers={providers}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            disabled={isGenerating}
            loading={loading}
          />

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`
                relative inline-flex items-center justify-center gap-2
                px-8 py-3 rounded-2xl text-sm font-semibold
                transition-all duration-300 cursor-pointer select-none
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                ${
                  canGenerate
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5 active:translate-y-0'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                }
              `}
            >
              {isGenerating ? '生成中...' : '生成小红书改写稿'}
            </button>

            {isComplete && (
              <button
                type="button"
                onClick={handleRewriteAnother}
                className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl text-sm font-medium text-neutral-500 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200 cursor-pointer select-none"
              >
                重写另一篇
              </button>
            )}
          </div>
        </section>
      </section>

      {(isGenerating || result) && <div className="border-t border-neutral-200" />}

      {isGenerating && (
        <section className="mb-6">
          <ProgressIndicator
            currentStep={currentStep}
            isGenerating={isGenerating}
            steps={GENERATION_STEPS}
            tone="primary"
          />
        </section>
      )}

      {error && (
        <section className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <span>生成失败：{error}</span>
          </div>
        </section>
      )}

      {result && (
        <section ref={outputRef} className="space-y-8 pb-12">
          {isComplete && (
            <div className="flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-700">小红书改写稿已生成</span>
              </div>
              <CopyButton text={getAllText()} size="md" label="复制全部" />
            </div>
          )}

          {showTitles && <CoverTitles titles={result.coverTitles} />}
          {showCards && <SlideCards cards={result.cards} />}
          {showCaption && <Caption text={result.caption} />}
          {showTags && <HashtagGroups groups={result.tagGroups} />}
        </section>
      )}

      {!result && !isGenerating && (
        <section className="py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-neutral-100 mb-4">
            <svg
              className="w-8 h-8 text-neutral-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <p className="text-sm text-neutral-400 mb-1">粘贴公众号文章，选择语气后开始生成。</p>
          <p className="text-xs text-neutral-300">
            生成结果会按封面标题、图文卡片、正文和标签分区展示。
          </p>
        </section>
      )}
    </main>
  );
}
