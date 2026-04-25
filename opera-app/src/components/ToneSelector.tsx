import type { ToneType, ToneOption } from '../types';
import { TONE_OPTIONS } from '../constants';

interface ToneSelectorProps {
  /** 当前选中的调性 */
  selected: ToneType | null;
  /** 选择回调 */
  onSelect: (tone: ToneType) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 调性选择器组件
 * - 3 种预设调性卡片
 * - 选中状态有高亮边框和背景
 * - 移动端竖排，桌面端横排
 */
export default function ToneSelector({
  selected,
  onSelect,
  disabled = false,
}: ToneSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-neutral-700">
          选择内容调性
        </label>
        <span className="text-xs text-neutral-400">
          决定生成内容的风格和语气
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TONE_OPTIONS.map((tone: ToneOption) => {
          const isSelected = selected === tone.id;
          return (
            <button
              key={tone.id}
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
              {/* 选中指示器 */}
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

              {/* Emoji */}
              <div className="text-2xl mb-2">{tone.emoji}</div>

              {/* 标题 */}
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

              {/* 描述 */}
              <p className="text-xs text-neutral-500 leading-relaxed mb-2.5">
                {tone.description}
              </p>

              {/* 示例 */}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
