import { useState, useCallback, useRef } from 'react';
import type { ToneType, GenerationStep, GenerationResult, TagGroup } from './types';
import Header from './components/Header';
import TextInput from './components/TextInput';
import ToneSelector from './components/ToneSelector';
import ProgressIndicator from './components/ProgressIndicator';
import CoverTitles from './components/CoverTitles';
import SlideCards from './components/SlideCards';
import Caption from './components/Caption';
import HashtagGroups from './components/HashtagGroups';
import CopyButton from './components/CopyButton';

const API_BASE = 'http://localhost:3001';

/**
 * Opera 主应用组件
 *
 * 核心工作流：粘贴文本 → 选择调性 → AI 转换 → 预览/编辑 → 复制使用
 * 单页应用，无需路由，无需登录
 */
export default function App() {
  // ── 状态 ──────────────────────────────────────
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState<ToneType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<GenerationStep>('extracting');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 渐进渲染：每部分独立控制显隐
  const [showTitles, setShowTitles] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canGenerate =
    inputText.trim().length > 0 && selectedTone !== null && !isGenerating;

  // ── SSE 流式生成 ──────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    // 重置状态
    setIsGenerating(true);
    setCurrentStep('extracting');
    setResult(null);
    setError(null);
    setShowTitles(false);
    setShowCards(false);
    setShowCaption(false);
    setShowTags(false);

    // 取消上一次请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 累积结果
    const partial: GenerationResult = {
      coverTitles: [],
      cards: [],
      caption: '',
      tagGroups: [],
    };

    try {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, tone: selectedTone }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete line in buffer

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
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setIsGenerating(false);
    }
  }, [canGenerate, inputText, selectedTone]);

  // ── 重新生成 ──────────────────────────────────
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

  // ── 组装"一键复制全部"文本 ──────────────────
  const getAllText = (): string => {
    if (!result) return '';
    const sections: string[] = [];

    sections.push('【封面标题】');
    result.coverTitles.forEach((t, i) => sections.push(`${i + 1}. ${t}`));

    sections.push('\n【卡片文字】');
    result.cards.forEach((c, i) => sections.push(`--- 第${i + 1}张 ---\n${c}`));

    sections.push('\n【正文文案】');
    sections.push(result.caption);

    sections.push('\n【推荐标签】');
    result.tagGroups.forEach((g) => {
      sections.push(`${g.label}：${g.tags.map((t) => '#' + t).join(' ')}`);
    });

    return sections.join('\n');
  };

  const isComplete = result !== null && currentStep === 'done';

  // ── 渲染 ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ====== 输入区 ====== */}
        <section className="space-y-6 mb-8">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight mb-2">
              公众号文章，一键变小红书
            </h1>
            <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto">
              粘贴你的公众号长文，选择内容调性，AI 自动生成小红书内容包 —— 封面标题、卡片文字、正文文案、标签推荐，一步到位。
            </p>
          </div>

          {/* 文本输入 */}
          <TextInput
            value={inputText}
            onChange={setInputText}
            disabled={isGenerating}
          />

          {/* 调性选择 */}
          <ToneSelector
            selected={selectedTone}
            onSelect={setSelectedTone}
            disabled={isGenerating}
          />

          {/* 生成按钮 */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`
                relative inline-flex items-center justify-center gap-2
                px-8 py-3 rounded-2xl text-sm font-semibold
                transition-all duration-300 cursor-pointer select-none
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                ${
                  canGenerate
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                    />
                  </svg>
                  <span>开始生成</span>
                </>
              )}
            </button>

            {isComplete && (
              <button
                onClick={handleReset}
                className="
                  inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl
                  text-sm font-medium text-neutral-500 bg-white border border-neutral-200
                  hover:bg-neutral-50 hover:border-neutral-300
                  transition-all duration-200 cursor-pointer select-none
                "
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992"
                  />
                </svg>
                <span>重新生成</span>
              </button>
            )}
          </div>
        </section>

        {/* ====== 分割线 ====== */}
        {(isGenerating || result) && (
          <div className="border-t border-neutral-200 my-6" />
        )}

        {/* ====== 进度指示器 ====== */}
        {isGenerating && (
          <section className="mb-6">
            <ProgressIndicator
              currentStep={currentStep}
              isGenerating={isGenerating}
            />
          </section>
        )}

        {/* ====== 错误提示 ====== */}
        {error && (
          <section className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>生成失败：{error}</span>
            </div>
          </section>
        )}

        {/* ====== 输出区 ====== */}
        {result && (
          <section ref={outputRef} className="space-y-8 pb-12">
            {/* 一键复制全部 - 完成后显示 */}
            {isComplete && (
              <div className="flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-success-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-neutral-700">
                    内容包已生成完毕
                  </span>
                </div>
                <CopyButton
                  text={getAllText()}
                  size="md"
                  label="一键复制全部"
                />
              </div>
            )}

            {/* 封面标题 */}
            {showTitles && (
              <CoverTitles titles={result.coverTitles} />
            )}

            {/* 卡片文字 */}
            {showCards && <SlideCards cards={result.cards} />}

            {/* 正文文案 */}
            {showCaption && <Caption text={result.caption} />}

            {/* 标签推荐 */}
            {showTags && <HashtagGroups groups={result.tagGroups} />}
          </section>
        )}

        {/* ====== 空状态引导 ====== */}
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
            <p className="text-sm text-neutral-400 mb-1">
              粘贴文章并选择调性后即可开始生成
            </p>
            <p className="text-xs text-neutral-300">
              生成结果将按 封面标题 / 卡片文字 / 正文文案 / 标签推荐 依次展示
            </p>
          </section>
        )}
      </main>

      {/* ====== 底部 ====== */}
      <footer className="border-t border-neutral-100 bg-white/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-neutral-300">
            Opera - 内容适配工具
          </span>
          <span className="text-xs text-neutral-300">
            无需登录 / 免费使用
          </span>
        </div>
      </footer>
    </div>
  );
}
