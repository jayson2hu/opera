import { useEffect, useRef } from 'react';
import { countChars } from '../../constants';
import CopyButton from '../CopyButton';

interface EditableBodyProps {
  value: string;
  onChange: (value: string) => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'accent';
}

const TONE_STYLES = {
  primary: 'hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50',
  accent: 'hover:text-accent-600 hover:border-accent-300 hover:bg-accent-50',
} as const;

export default function EditableBody({
  value,
  onChange,
  onRegenerate,
  canRegenerate,
  disabled = false,
  tone = 'accent',
}: EditableBodyProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = countChars(value);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(200, element.scrollHeight)}px`;
  }, [value]);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-card space-y-3 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
          正文
        </span>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>{charCount} 字</span>
          <CopyButton text={value} size="sm" />
          <button
            type="button"
            onClick={onRegenerate}
            disabled={!canRegenerate || disabled}
            title="重新生成正文"
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 text-neutral-400 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${TONE_STYLES[tone]}`}
          >
            ↺
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="正文会以流式方式逐步生成，可直接修改"
        disabled={disabled}
        className="w-full min-h-[200px] text-sm text-neutral-700 leading-relaxed border-0 outline-none bg-transparent resize-none placeholder:text-neutral-300 disabled:cursor-not-allowed"
      />
    </div>
  );
}
