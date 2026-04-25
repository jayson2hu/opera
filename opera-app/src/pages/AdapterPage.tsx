import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GenerationResult,
  GenerationStep,
  ProviderSelectionProps,
  TagGroup,
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


export default function AdapterPage({
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  loading = false,
  error: providerError = null,
}: ProviderSelectionProps) {
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState<ToneType | null>(null);
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
                if (data.step === 'done') {
                  setIsGenerating(false);
                }
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
  }, [canGenerate, inputText, selectedTone, selectedProvider, selectedModel]);

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

  const getAllText = (): string => {
    if (!result) return '';

    const sections: string[] = [];
    sections.push('【封面标题】');
    result.coverTitles.forEach((title, index) => sections.push(`${index + 1}. ${title}`));
    sections.push('\n【卡片文字】');
    result.cards.forEach((card, index) => sections.push(`--- 第${index + 1}张 ---\n${card}`));
    sections.push('\n【正文文案】');
    sections.push(result.caption);
    sections.push('\n【推荐标签】');
    result.tagGroups.forEach((group) => {
      sections.push(`${group.label}：${group.tags.map((tag) => `#${tag}`).join(' ')}`);
    });
    return sections.join('\n');
  };

  const isComplete = result !== null && currentStep === 'done';

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <section className="space-y-6 mb-8">
        <div className="text-center mb-10 mt-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-600 tracking-tight mb-4 pb-1">
            公众号文章，<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-600">一键变小红书</span>
          </h1>
          <p className="text-sm sm:text-base text-neutral-500 max-w-xl mx-auto leading-relaxed">
            粘贴你的公众号长文，选择内容调性，AI 自动生成小红书内容包 —— 封面标题、卡片文字、正文文案、标签推荐，一步到位。
          </p>
        </div>

        {providerError && (
          <section className="p-4 bg-warning-50 border border-warning-500/20 rounded-xl text-sm text-warning-500">
            模型配置读取失败：{providerError}
          </section>
        )}

        <TextInput value={inputText} onChange={setInputText} disabled={isGenerating} />

        <ToneSelector
          selected={selectedTone}
          onSelect={setSelectedTone}
          disabled={isGenerating}
        />

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
            {isGenerating ? '生成中...' : '开始生成'}
          </button>

          {isComplete && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl text-sm font-medium text-neutral-500 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200 cursor-pointer select-none"
            >
              <span>重新生成</span>
            </button>
          )}
        </div>
      </section>

      {(isGenerating || result) && <div className="border-t border-neutral-200 my-6" />}

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
                <span className="text-sm font-medium text-neutral-700">内容包已生成完毕</span>
              </div>
              <CopyButton text={getAllText()} size="md" label="一键复制全部" />
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
          <p className="text-sm text-neutral-400 mb-1">粘贴文章并选择调性后即可开始生成</p>
          <p className="text-xs text-neutral-300">
            生成结果将按 封面标题 / 卡片文字 / 正文文案 / 标签推荐 依次展示
          </p>
        </section>
      )}
    </main>
  );
}
