import { useMemo, useState } from 'react';
import CopyButton from './CopyButton';
import { downloadCardImage } from '../lib/cardImageExporter';
import { readPreferences } from '../lib/preferences';
import { getSlideCardContent, getSlideCardType, updateSlideCardContent } from '../lib/slideCards';
import type { SlideCardType, SlideCardValue } from '../types';
import { toast } from '../lib/toast';

interface SlideCardsOptimizedProps {
  cards: SlideCardValue[];
  selectedIndices: Set<number>;
  onToggleSelect: (index: number) => void;
  onChange?: (cards: SlideCardValue[]) => void;
}

const PURPOSE_META: Record<SlideCardType, { label: string; className: string; bar: string; accent: string }> = {
  hook: {
    label: '开头钩子',
    className: 'bg-primary-50 text-primary-600',
    bar: 'from-primary-400 to-primary-600',
    accent: '#ee8019',
  },
  insight: {
    label: '核心洞察',
    className: 'bg-accent-50 text-accent-600',
    bar: 'from-accent-400 to-accent-600',
    accent: '#8b5cf6',
  },
  method: {
    label: '方法论',
    className: 'bg-emerald-50 text-emerald-600',
    bar: 'from-emerald-400 to-emerald-600',
    accent: '#10b981',
  },
  scenario: {
    label: '应用场景',
    className: 'bg-blue-50 text-blue-600',
    bar: 'from-blue-400 to-blue-600',
    accent: '#3b82f6',
  },
  summary: {
    label: '行动总结',
    className: 'bg-amber-50 text-amber-600',
    bar: 'from-amber-400 to-amber-600',
    accent: '#f59e0b',
  },
};

export default function SlideCardsOptimized({
  cards,
  selectedIndices,
  onToggleSelect,
  onChange,
}: SlideCardsOptimizedProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);
  const allText = useMemo(
    () => cards.map(getSlideCardContent).join('\n\n---\n\n'),
    [cards],
  );

  const handleEdit = (index: number, value: string) => {
    const next = cards.map((card, cardIndex) => (
      cardIndex === index ? updateSlideCardContent(card, value) : card
    ));
    onChange?.(next);
  };

  const handleCopyCard = async (card: string, index: number) => {
    try {
      await navigator.clipboard.writeText(card);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = card;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
  };

  const handleExportCard = async (card: SlideCardValue, index: number, purpose: string, accent: string) => {
    setExportingIndex(index);
    const { showWatermark } = readPreferences();
    try {
      await downloadCardImage(
        { text: getSlideCardContent(card), index: index + 1, purpose },
        {
          accent,
          filename: `opera-card-${String(index + 1).padStart(2, '0')}.png`,
          showWatermark,
        },
      );
      toast(`第 ${index + 1} 张卡片已导出`);
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : '卡片导出失败');
    } finally {
      setExportingIndex(null);
    }
  };

  if (cards.length === 0) return null;

  return (
    <div className="animate-slide-up">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-accent-500" />
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">小红书图文卡片</h3>
            <p className="mt-0.5 text-xs text-neutral-400">{cards.length} 张卡片，可复制或导出为图片</p>
          </div>
        </div>
        <CopyButton text={allText} label="复制全部卡片" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {cards.map((card, index) => {
          const type = getSlideCardType(card, index);
          const purpose = PURPOSE_META[type];
          const text = getSlideCardContent(card);
          const charCount = text.replace(/\s/g, '').length;
          const isEditing = editingIndex === index;
          const isChecked = selectedIndices.has(index);
          const isCopied = copiedIndex === index;
          const isExporting = exportingIndex === index;

          return (
            <article
              key={`${index}-${type}`}
              className={`group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-within:border-primary-300 ${
                isChecked ? 'border-primary-400 bg-primary-50/40' : 'border-neutral-200'
              }`}
            >
              <div className={`h-1.5 bg-gradient-to-r ${purpose.bar}`} />
              <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(index)}
                    aria-label={isChecked ? `取消选择卡片 ${index + 1}` : `选择卡片 ${index + 1}`}
                    aria-pressed={isChecked}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
                      isChecked ? 'border-primary-500 bg-primary-500' : 'border-neutral-300 bg-white hover:border-primary-400'
                    }`}
                  >
                    {isChecked && <span aria-hidden="true" className="text-xs font-bold text-white">✓</span>}
                  </button>
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${purpose.bar.includes('accent') ? 'bg-accent-500' : purpose.bar.includes('emerald') ? 'bg-emerald-500' : purpose.bar.includes('blue') ? 'bg-blue-500' : purpose.bar.includes('amber') ? 'bg-amber-500' : 'bg-primary-500'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${purpose.className}`}>{purpose.label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingIndex(isEditing ? null : index)}
                    aria-label={isEditing ? '完成编辑卡片' : '编辑卡片'}
                    className="rounded-md px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-primary-50 hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-primary-500"
                  >
                    {isEditing ? '完成' : '编辑'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportCard(card, index, purpose.label, purpose.accent)}
                    disabled={isExporting}
                    aria-label={isExporting ? `正在导出卡片 ${index + 1}` : `导出卡片 ${index + 1} 图片`}
                    title="导出图片"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-400 opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary-500"
                  >
                    {isExporting ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-500" />
                    ) : (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyCard(text, index)}
                    aria-label={isCopied ? '卡片已复制' : `复制卡片 ${index + 1}`}
                    title="复制卡片"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all focus-visible:outline-2 focus-visible:outline-primary-500 ${
                      isCopied
                        ? 'border-emerald-500/30 bg-emerald-50 text-emerald-500 opacity-100'
                        : 'border-neutral-200 bg-white text-neutral-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600'
                    }`}
                  >
                    {isCopied ? '✓' : '⧉'}
                  </button>
                </div>
              </div>
              <div className="border-b border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
                {charCount} 字 · 建议 70-110 字
              </div>
              <div className="bg-gradient-to-b from-neutral-50 to-neutral-100/70 p-4">
                {isEditing ? (
                  <textarea
                    value={text}
                    onChange={(event) => handleEdit(index, event.target.value)}
                    className="min-h-32 w-full resize-y rounded-lg border border-primary-200 bg-white p-3 text-base leading-7 text-neutral-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    rows={5}
                    aria-label={`编辑第 ${index + 1} 张卡片`}
                  />
                ) : (
                  <p className="min-h-32 whitespace-pre-wrap text-base leading-7 text-neutral-800">{text}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
