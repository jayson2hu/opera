import { useEffect, useRef } from 'react';
import { countChars } from '../../constants';

interface TopicInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minChars?: number;
}
export default function TopicInput({
  value,
  onChange,
  disabled = false,
  minChars = 10,
}: TopicInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = countChars(value);
  const hasContent = value.trim().length > 0;
  const remainingChars = Math.max(0, minChars - charCount);
  const isTooShort = hasContent && remainingChars > 0;
  const isReady = charCount >= minChars;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(120, element.scrollHeight)}px`;
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor="composer-topic" className="block text-sm font-medium text-neutral-700">
          主题描述
        </label>
        <span className="text-xs text-neutral-400">至少 {minChars} 字，描述越具体生成越准</span>
      </div>

      <div
        className={`
          relative rounded-2xl border-2 transition-all duration-300 overflow-hidden
          ${
            disabled
              ? 'border-neutral-200 bg-neutral-50 opacity-60'
              : isTooShort
                ? 'border-amber-300 bg-amber-50/40 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-500/10'
                : isReady
                  ? 'border-primary-300 bg-white shadow-md shadow-primary-500/5 focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-500/10'
                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-500/10'
          }
        `}
      >
        <textarea
          ref={textareaRef}
          id="composer-topic"
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, 500))}
          disabled={disabled}
          placeholder="例：分享我用番茄工作法戒掉拖延症的经历，实测 3 个月有效，也想写给总是拖到最后才开始行动的人"
          className="w-full min-h-[120px] bg-transparent px-4 pt-4 pb-14 text-[15px] leading-relaxed text-neutral-800 resize-none placeholder:text-neutral-300 outline-none disabled:cursor-not-allowed"
          aria-describedby="composer-topic-status"
        />

        <div
          id="composer-topic-status"
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 rounded-b-2xl border-t border-neutral-100 bg-neutral-50/80 px-4 py-2.5"
        >
          <span
            className={`text-xs ${
              isTooShort ? 'text-amber-600' : isReady ? 'text-emerald-600' : 'text-neutral-400'
            }`}
          >
            {isTooShort
              ? `再补充 ${remainingChars} 个字，就可以开始创作`
              : isReady
                ? '主题描述已达标，可以继续选择类型和调性'
                : `先写下你的创作主题，至少 ${minChars} 字`}
          </span>
          <span
            className={`shrink-0 text-xs font-medium ${
              isTooShort ? 'text-amber-600' : isReady ? 'text-neutral-600' : 'text-neutral-400'
            }`}
          >
            {charCount}/500
          </span>
        </div>
      </div>
    </div>
  );
}
