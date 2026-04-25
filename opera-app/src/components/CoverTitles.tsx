import { useState } from 'react';
import CopyButton from './CopyButton';

interface CoverTitlesProps {
  titles: string[];
}

export default function CoverTitles({ titles }: CoverTitlesProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  if (titles.length === 0) return null;

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
                  isSelected
                    ? 'border-primary-400 bg-primary-50/50 shadow-card'
                    : 'border-transparent bg-neutral-50 hover:bg-white hover:border-neutral-200 hover:shadow-card'
                }
              `}
            >
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

              <span
                className={`
                  flex-1 text-[15px] leading-snug font-medium
                  ${isSelected ? 'text-neutral-900' : 'text-neutral-600'}
                `}
              >
                {title}
              </span>

              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={title} size="sm" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
