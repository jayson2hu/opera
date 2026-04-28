import { useState } from 'react';
import CopyButton from './CopyButton';

interface SlideCardsProps {
  cards: string[];
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

export default function SlideCards({ cards }: SlideCardsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedCards, setEditedCards] = useState<string[]>(cards);

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
          const isTargetLength = charCount >= 70 && charCount <= 110;

          return (
            <article
              key={i}
              tabIndex={0}
              className={`
                group relative bg-white rounded-xl border border-neutral-200 overflow-hidden
                shadow-sm ${accent.glow}
                transition-all duration-300
                hover:-translate-y-1 hover:shadow-xl hover:border-primary-200
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
              `}
            >
              <div className={`h-1.5 bg-gradient-to-r ${accent.bar}`} />

              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tracking-wide ${accent.badge}`}
                  >
                    {String(i + 1).padStart(2, '0')}
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
                  <CopyButton text={card} size="sm" />
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
