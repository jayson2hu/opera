import { useState } from 'react';
import CopyButton from './CopyButton';

interface SlideCardsProps {
  cards: string[];
}

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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-accent-500" />
          <h3 className="text-sm font-semibold text-neutral-800">
            卡片文案
          </h3>
          <span className="text-xs text-neutral-400">
            {cards.length} 张卡片
          </span>
        </div>
        <CopyButton text={allText} label="复制全部卡片" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {editedCards.map((card, i) => {
          const isEditing = editingIndex === i;
          const charCount = card.replace(/\s/g, '').length;

          return (
            <div
              key={i}
              className="group relative bg-white rounded-xl border border-neutral-200 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary-200 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-50 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-500">
                    第 {i + 1} 张
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                      charCount >= 50 && charCount <= 80
                        ? 'bg-success-50 text-success-500'
                        : 'bg-warning-50 text-warning-500'
                    }`}
                  >
                    {charCount} 字
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingIndex(isEditing ? null : i)}
                    className="text-xs text-neutral-400 hover:text-primary-500 transition-colors px-1.5 py-0.5 cursor-pointer"
                    aria-label={isEditing ? '完成编辑' : '编辑卡片'}
                  >
                    {isEditing ? '完成' : '编辑'}
                  </button>
                  <CopyButton text={card} size="sm" />
                </div>
              </div>

              <div className="p-3.5">
                {isEditing ? (
                  <textarea
                    value={editedCards[i]}
                    onChange={(e) => handleEdit(i, e.target.value)}
                    className="w-full text-sm leading-relaxed text-neutral-700 bg-primary-50/30 border border-primary-200 rounded-lg p-2.5 outline-none resize-none focus:border-primary-400"
                    rows={4}
                    aria-label={`编辑第 ${i + 1} 张卡片`}
                  />
                ) : (
                  <p className="text-sm leading-relaxed text-neutral-700">
                    {card}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
