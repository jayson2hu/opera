import { useCallback, useEffect, useRef, useState } from 'react';
import type {
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
import ProviderSelector from '../components/ProviderSelector';
import ProgressIndicator from '../components/ProgressIndicator';
import ToneSelector from '../components/ToneSelector';
import ContentTypeSelector from '../components/composer/ContentTypeSelector';
import EditableBody from '../components/composer/EditableBody';
import EditableTags from '../components/composer/EditableTags';
import EditableTitle from '../components/composer/EditableTitle';
import ImageSuggestion from '../components/composer/ImageSuggestion';
import LengthSelector from '../components/composer/LengthSelector';
import PublishActions from '../components/composer/PublishActions';
import TopicInput from '../components/composer/TopicInput';

const MIN_TOPIC_CHARS = 10;
const EMPTY_RESULT: ComposerResult = {
  title: '',
  body: '',
  tags: [],
  imageKeywords: [],
};

function getComposeRequestError(status: number, errorMessage?: string) {
  if (status === 404) {
    return '未找到 /api/compose。请确认正在运行 FastAPI 后端：start-backend.ps1、start-backend.sh 或 docker compose up --build。';
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
}: ProviderSelectionProps) {
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [selectedTone, setSelectedTone] = useState<ToneType | null>(null);
  const [targetLength, setTargetLength] = useState<TargetLength>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<ComposerStep>('extracting');
  const [result, setResult] = useState<ComposerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    contentType === null ? '请选择内容类型' : null,
    selectedTone === null ? '请选择语气' : null,
  ].filter((item): item is string => item !== null);
  const canSubmitBase = missingRequirements.length === 0;
  const canGenerate = canSubmitBase && !isGenerating;
  const submitHint = isGenerating
    ? 'AI 正在生成原创帖子，请稍候...'
    : canSubmitBase
      ? '准备就绪，可以开始生成。'
      : `还需要：${missingRequirements.join('、')}`;
  const hasAnyOutput =
    result !== null &&
    (result.title.trim().length > 0 ||
      result.body.trim().length > 0 ||
      result.tags.length > 0 ||
      result.imageKeywords.length > 0);
  const isComplete = result !== null && currentStep === 'done';

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runCompose = useCallback(
    async (regenerate?: ComposerRegenerateTarget) => {
      if ((!regenerate && !canGenerate) || (regenerate && (!canSubmitBase || !result))) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const partial: ComposerResult = regenerate ? { ...(result ?? EMPTY_RESULT) } : { ...EMPTY_RESULT };
      if (regenerate === 'title') partial.title = '';
      if (regenerate === 'body') partial.body = '';
      if (regenerate === 'tags') {
        partial.tags = [];
        partial.imageKeywords = [];
      }

      setIsGenerating(true);
      setCurrentStep('extracting');
      setError(null);
      setResult(partial);

      const payload: ComposerRequest = {
        topic,
        contentType: contentType!,
        tone: selectedTone!,
        targetLength,
        ...(selectedProvider ? { provider: selectedProvider } : {}),
        ...(selectedModel ? { model: selectedModel } : {}),
        ...(regenerate ? { regenerate } : {}),
      };

      try {
        const response = await fetch(buildApiUrl('/api/compose'), {
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
                  setCurrentStep(data.step as ComposerStep);
                  if (data.step === 'done') setIsGenerating(false);
                  break;
                case 'title':
                  partial.title = data.title;
                  setResult({ ...partial });
                  break;
                case 'body':
                  partial.body = data.body;
                  setResult({ ...partial });
                  break;
                case 'tags':
                  partial.tags = data.tags;
                  partial.imageKeywords = data.imageKeywords;
                  setResult({ ...partial });
                  break;
                case 'error':
                  throw new Error(data.error || 'Compose failed');
              }

              if (!didScroll && (eventType === 'title' || eventType === 'body')) {
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
      canGenerate,
      canSubmitBase,
      contentType,
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
  }, []);

  const fullText = result
    ? [
        result.title.trim(),
        result.body.trim(),
        result.tags.length ? result.tags.map((tag) => `#${tag}`).join(' ') : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <section className="space-y-6 mb-8">
        <div className="space-y-3 mt-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
            从一个选题生成小红书原创帖子
          </h1>
          <p className="text-sm sm:text-base text-neutral-500 leading-relaxed max-w-2xl">
            输入主题，选择内容类型、语气和篇幅，系统会生成标题、正文、标签和配图关键词。
          </p>
        </div>

        {providerError && (
          <section className="p-4 bg-warning-50 border border-warning-500/20 rounded-xl text-sm text-warning-500">
            模型服务加载失败：{providerError}
          </section>
        )}

        <TopicInput value={topic} onChange={setTopic} disabled={isGenerating} minChars={MIN_TOPIC_CHARS} />
        <ContentTypeSelector selected={contentType} onSelect={setContentType} disabled={isGenerating} />
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
              className={
                canGenerate
                  ? 'px-10 py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-md shadow-accent-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer'
                  : 'px-10 py-3 rounded-2xl text-sm font-semibold bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }
            >
              {isGenerating ? '生成中...' : '生成原创帖子'}
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

          <p
            className={`text-sm ${isGenerating ? 'text-neutral-500' : canSubmitBase ? 'text-emerald-600' : 'text-amber-600'}`}
            aria-live="polite"
          >
            {submitHint}
          </p>
        </div>
      </section>

      {(isGenerating || hasAnyOutput) && <div className="border-t border-neutral-200 my-6" />}

      {isGenerating && (
        <section className="mb-6">
          <ProgressIndicator
            currentStep={currentStep}
            isGenerating={isGenerating}
            steps={COMPOSER_STEPS}
            tone="accent"
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

      {result && hasAnyOutput && (
        <section ref={outputRef} className="space-y-5 pb-12">
          <EditableTitle
            value={result.title}
            onChange={(value) => setResult((current) => (current ? { ...current, title: value } : current))}
            onRegenerate={() => void runCompose('title')}
            canRegenerate={canSubmitBase && !isGenerating}
            disabled={isGenerating}
          />

          <EditableBody
            value={result.body}
            onChange={(value) => setResult((current) => (current ? { ...current, body: value } : current))}
            onRegenerate={() => void runCompose('body')}
            canRegenerate={canSubmitBase && !isGenerating}
            disabled={isGenerating}
          />

          <ImageSuggestion keywords={result.imageKeywords} />

          {(result.tags.length > 0 || isComplete) && (
            <EditableTags
              tags={result.tags}
              onChange={(tags) => setResult((current) => (current ? { ...current, tags } : current))}
              onRegenerate={() => void runCompose('tags')}
              canRegenerate={canSubmitBase && !isGenerating}
              disabled={isGenerating}
            />
          )}

          <PublishActions text={fullText} />
        </section>
      )}

      {!hasAnyOutput && !isGenerating && (
        <section className="py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-50 mb-4 text-accent-400 text-2xl">
            ✍️
          </div>
          <p className="text-sm text-neutral-400 mb-1">填写选题后生成一篇可编辑的小红书帖子</p>
          <p className="text-xs text-neutral-300">
            支持单独重生成标题、正文或标签。
          </p>
        </section>
      )}
    </main>
  );
}
