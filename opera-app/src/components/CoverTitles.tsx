import { useState } from 'react';
import CopyButton from './CopyButton';

interface CoverTitlesProps {
  titles: string[];
  selectedIndices: Set<number>;
  onToggleSelect: (index: number) => void;
}

export default function CoverTitles({ titles, selectedIndices, onToggleSelect }: CoverTitlesProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (titles.length === 0) return null;

  const handleCopyTitle = async (title: string, index: number) => {
    try {
      await navigator.clipboard.writeText(title);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = title;
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-primary-500" />
          <h3 className="text-sm font-semibold text-neutral-800">
            封面标题
          </h3>
          <span className="text-xs text-neutral-400">
            {titles.length} 个备选
          </span>
        </div>
        <CopyButton text={titles[selectedIndex]} label="复制选中" />
      </div>

      <div className="space-y-2">
        {titles.map((title, i) => {
          const isSelected = i === selectedIndex;
          const isChecked = selectedIndices.has(i);
          const isCopied = copiedIndex === i;
          return (
            <div
              key={i}
              onClick={() => setSelectedIndex(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedIndex(i);
                }
              }}
              aria-pressed={isSelected}
              className={`
                group relative flex items-start gap-3 p-3.5 rounded-xl
                border-2 transition-all duration-200 cursor-pointer select-none
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                ${
                  isChecked
                    ? 'border-primary-400 bg-primary-50/40 shadow-card'
                    : isSelected
                      ? 'border-primary-200 bg-primary-50/20 shadow-card'
                      : 'border-neutral-200 bg-white hover:shadow-card'
                }
              `}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSelect(i);
                }}
                aria-label={isChecked ? `取消选择标题 ${i + 1}` : `选择标题 ${i + 1}`}
                aria-pressed={isChecked}
                className={`
                  mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2
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
                className={`
                  flex-shrink-0 w-6 h-6 rounded-lg text-xs font-semibold
                  flex items-center justify-center
                  ${
                    isSelected
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-200 text-neutral-500 group-hover:bg-neutral-300'
                  }
                `}
              >
                {i + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`
                    block text-[15px] leading-snug font-medium
                    ${isSelected ? 'text-neutral-900' : 'text-neutral-600'}
                  `}
                >
                  {title}
                </span>
                {i === 0 && (
                  <span className="mt-2 inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                    AI 推荐
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCopyTitle(title, i);
                }}
                aria-label={isCopied ? '标题已复制' : `复制标题 ${i + 1}`}
                className={`
                  flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border
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
          );
        })}
      </div>
    </div>
  );
}
