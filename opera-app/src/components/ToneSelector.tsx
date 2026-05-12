import type { ToneType, ToneOption } from '../types';
import { TONE_OPTIONS } from '../constants';

interface ToneSelectorProps {
  selected: ToneType | null;
  onSelect: (tone: ToneType) => void;
  disabled?: boolean;
}

const FALLBACK_TONE_TAGS: Record<ToneType, string[]> = {
  knowledge: ['逻辑清晰', '专业可信', '适合干货'],
  casual: ['轻松自然', '像朋友聊天', '适合种草'],
  bff: ['亲密陪伴', '情绪共鸣', '适合私域'],
};

export default function ToneSelector({
  selected,
  onSelect,
  disabled = false,
}: ToneSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-neutral-700">
          选择语气
        </label>
        <span className="text-xs text-neutral-400">
          用来控制生成内容的表达风格
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TONE_OPTIONS.map((tone: ToneOption) => {
          const isSelected = selected === tone.id;
          const tags = tone.tags ?? FALLBACK_TONE_TAGS[tone.id];
          return (
            <button
              key={tone.id}
              type="button"
              onClick={() => onSelect(tone.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`
                group relative text-left p-4 rounded-2xl border-2 transition-all duration-300
                cursor-pointer select-none
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  isSelected
                    ? 'border-primary-400 bg-primary-50/60 shadow-md shadow-primary-500/10 scale-[1.02]'
                    : 'border-neutral-150 bg-white hover:border-neutral-300 hover:shadow-md hover:-translate-y-1'
                }
              `}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
              )}

              <div className="text-2xl mb-2">{tone.emoji}</div>
              <div className="mb-1">
                <span
                  className={`text-sm font-semibold ${isSelected ? 'text-primary-700' : 'text-neutral-800'}`}
                >
                  {tone.label}
                </span>
                <span className="ml-1.5 text-[11px] text-neutral-400 font-medium">
                  {tone.subtitle}
                </span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed mb-2.5">
                {tone.description}
              </p>
              <div
                className={`
                  text-xs px-2.5 py-1.5 rounded-lg leading-snug italic
                  ${
                    isSelected
                      ? 'bg-primary-100/60 text-primary-600'
                      : 'bg-neutral-50 text-neutral-400 group-hover:bg-neutral-100'
                  }
                `}
              >
                "{tone.example}"
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={`
                      rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5
                      ${
                        isSelected
                          ? 'border-primary-200 bg-white/80 text-primary-600'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-500 group-hover:border-neutral-300'
                      }
                    `}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
