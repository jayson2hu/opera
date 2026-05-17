import { useState } from 'react';
import CopyButton from './CopyButton';

interface SlideCardsProps {
  cards: string[];
  selectedIndices: Set<number>;
  onToggleSelect: (index: number) => void;
}

const CARD_ACCENTS = [
  {
    bar: 'from-primary-400 to-primary-600',
    badge: 'bg-primary-500 text-white',
    glow: 'shadow-primary-500/10',
  },
  {
    bar: 'from-accent-400 to-accent-600',
    badge: 'bg-accent-500 text-white',
    glow: 'shadow-accent-500/10',
  },
  {
    bar: 'from-emerald-400 to-emerald-600',
    badge: 'bg-emerald-500 text-white',
    glow: 'shadow-emerald-500/10',
  },
];

const CARD_PURPOSES = [
  { label: '开头钩子', className: 'bg-primary-50 text-primary-600' },
  { label: '核心洞察', className: 'bg-accent-50 text-accent-600' },
  { label: '核心洞察', className: 'bg-accent-50 text-accent-600' },
  { label: '方法论', className: 'bg-emerald-50 text-emerald-600' },
  { label: '方法论', className: 'bg-emerald-50 text-emerald-600' },
  { label: '应用场景', className: 'bg-blue-50 text-blue-600' },
  { label: '行动总结', className: 'bg-amber-50 text-amber-600' },
];

export default function SlideCards({ cards, selectedIndices, onToggleSelect }: SlideCardsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedCards, setEditedCards] = useState<string[]>(cards);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (cards.length !== editedCards.length) {
    setEditedCards(cards);
  }

  const handleEdit = (index: number, value: string) => {
    const next = [...editedCards];
    next[index] = value;
    setEditedCards(next);
  };

  const allText = editedCards.join('\n\n---\n\n');

  if (cards.length === 0) return null;

  const handleCopyCard = async (card: string, index: number) => {
    try {
      await navigator.clipboard.writeText(card);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = card;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
  };

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-accent-500" />
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">
              小红书图文卡片
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {cards.length} 张卡片，可直接复制到设计工具排版
            </p>
          </div>
        </div>
        <CopyButton text={allText} label="复制全部卡片" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {editedCards.map((card, i) => {
          const isEditing = editingIndex === i;
          const charCount = card.replace(/\s/g, '').length;
          const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
          const purpose = CARD_PURPOSES[i] ?? CARD_PURPOSES[CARD_PURPOSES.length - 1];
          const isTargetLength = charCount >= 70 && charCount <= 110;
          const isCopied = copiedIndex === i;
          const isChecked = selectedIndices.has(i);

          return (
            <article
              key={i}
              tabIndex={0}
              className={`
                group relative rounded-xl border overflow-hidden
                shadow-sm ${accent.glow}
                transition-all duration-300
                hover:-translate-y-1 hover:shadow-xl hover:border-primary-200
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                ${isChecked ? 'border-primary-400 bg-primary-50/40 shadow-card' : 'border-neutral-200 bg-white'}
              `}
            >
              <div className={`h-1.5 bg-gradient-to-r ${accent.bar}`} />

              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(i)}
                    aria-label={isChecked ? `取消选择卡片 ${i + 1}` : `选择卡片 ${i + 1}`}
                    aria-pressed={isChecked}
                    className={`
                      flex h-5 w-5 shrink-0 items-center justify-center rounded border-2
                      transition-all duration-200 cursor-pointer
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                      ${isChecked ? 'border-primary-500 bg-primary-500' : 'border-neutral-300 bg-white hover:border-primary-400'}
                    `}
                  >
                    {isChecked && (
                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tracking-wide ${accent.badge}`}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${purpose.className}`}>
                    {purpose.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-700">小红书卡片</p>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        isTargetLength ? 'text-success-500' : 'text-warning-500'
                      }`}
                    >
                      {charCount} 字 · 建议 70-110 字
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingIndex(isEditing ? null : i)}
                    className="text-xs text-neutral-500 hover:text-primary-600 transition-colors px-2 py-1 rounded-md hover:bg-primary-50 cursor-pointer"
                    aria-label={isEditing ? '完成编辑卡片' : '编辑卡片'}
                  >
                    {isEditing ? '完成' : '编辑'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyCard(editedCards[i], i)}
                    aria-label={isCopied ? '卡片已复制' : `复制卡片 ${i + 1}`}
                    className={`
                      flex h-8 w-8 items-center justify-center rounded-lg border
                      transition-all duration-200 cursor-pointer
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                      ${isCopied
                        ? 'border-success-500/30 bg-success-50 text-success-500 opacity-100'
                        : 'border-neutral-200 bg-white text-neutral-400 opacity-0 group-hover:opacity-100 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600'
                      }
                    `}
                  >
                    {isCopied ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-b from-white to-neutral-50/70">
                {isEditing ? (
                  <textarea
                    value={editedCards[i]}
                    onChange={(e) => handleEdit(i, e.target.value)}
                    className="w-full min-h-32 text-base leading-7 text-neutral-800 bg-white border border-primary-200 rounded-lg p-3 outline-none resize-y focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    rows={5}
                    aria-label={`编辑第 ${i + 1} 张卡片`}
                  />
                ) : (
                  <p className="min-h-32 text-base leading-7 text-neutral-800 whitespace-pre-wrap">
                    {card}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
