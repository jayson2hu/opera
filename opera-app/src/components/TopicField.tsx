import { useEffect, useRef, useState } from 'react';

export type TopicFieldTone = 'primary' | 'accent' | 'emerald';

interface TopicFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** 达标字数；不足时边框/字数变黄 */
  minLen?: number;
  /** 多行模式：textarea；单行：input */
  multiline?: boolean;
  placeholder?: string;
  /** 主色调，决定 hover ⤢ / focus / 字数达标颜色 */
  tone?: TopicFieldTone;
  /** textarea 行数（multiline 时生效） */
  rows?: number;
  /** 给字段一个标题，渲染在左上方 */
  label?: string;
}

const TONE_CLASSES: Record<TopicFieldTone, {
  focus: string;
  okText: string;
  hoverIcon: string;
  modalBtn: string;
  iconBg: string;
}> = {
  primary: {
    focus: 'focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100',
    okText: 'text-primary-600',
    hoverIcon: 'hover:text-primary-600 hover:bg-primary-50',
    modalBtn: 'bg-primary-500 hover:bg-primary-600 shadow-primary-500/20',
    iconBg: 'bg-primary-50',
  },
  accent: {
    focus: 'focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-100',
    okText: 'text-accent-600',
    hoverIcon: 'hover:text-accent-600 hover:bg-accent-50',
    modalBtn: 'bg-accent-500 hover:bg-accent-600 shadow-accent-500/20',
    iconBg: 'bg-accent-50',
  },
  emerald: {
    focus: 'focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100',
    okText: 'text-emerald-600',
    hoverIcon: 'hover:text-emerald-600 hover:bg-emerald-50',
    modalBtn: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20',
    iconBg: 'bg-emerald-50',
  },
};

function countChars(text: string): number {
  return text.replace(/\s/g, '').length;
}

export default function TopicField({
  value,
  onChange,
  disabled = false,
  minLen = 0,
  multiline = false,
  placeholder = '在这里输入…',
  tone = 'primary',
  rows = 3,
  label,
}: TopicFieldProps) {
  const toneClasses = TONE_CLASSES[tone];
  const charCount = countChars(value);
  const isShort = charCount < minLen;
  const [modalOpen, setModalOpen] = useState(false);
  const modalTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Esc 关闭、200ms 内 focus 末尾
  useEffect(() => {
    if (!modalOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', onKey);

    const focusTimer = window.setTimeout(() => {
      const el = modalTextareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 80);

    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
    };
  }, [modalOpen]);

  return (
    <div className="space-y-2">
      {label && <div className="text-xs font-medium text-neutral-600">{label}</div>}
      <div
        className={`
          relative rounded-2xl border bg-white transition-all
          ${isShort && charCount > 0 ? 'border-warning-500/40' : 'border-neutral-200'}
          ${toneClasses.focus}
          ${disabled ? 'opacity-60' : ''}
        `}
      >
        {multiline ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            rows={rows}
            placeholder={placeholder}
            className="block w-full resize-none rounded-2xl border-0 bg-transparent px-4 py-3 pr-12 text-sm leading-relaxed text-neutral-800 placeholder:text-neutral-300 focus:outline-none"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="block w-full rounded-2xl border-0 bg-transparent px-4 py-3 pr-12 text-sm text-neutral-800 placeholder:text-neutral-300 focus:outline-none"
          />
        )}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={disabled}
          aria-label="放大编辑"
          className={`
            absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg
            border border-neutral-200 bg-white text-neutral-400 transition-all
            ${toneClasses.hoverIcon}
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
            disabled:cursor-not-allowed cursor-pointer
          `}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-400">
          {minLen > 0 && `建议 ≥ ${minLen} 字`}
        </span>
        <span className={isShort ? 'text-warning-600 font-medium' : `${toneClasses.okText} font-medium`}>
          {charCount} 字
        </span>
      </div>

      {modalOpen && (
        <TopicFieldModal
          value={value}
          onChange={onChange}
          onClose={() => setModalOpen(false)}
          minLen={minLen}
          tone={tone}
          textareaRef={modalTextareaRef}
        />
      )}
    </div>
  );
}

interface TopicFieldModalProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  minLen: number;
  tone: TopicFieldTone;
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
}

function TopicFieldModal({ value, onChange, onClose, minLen, tone, textareaRef }: TopicFieldModalProps) {
  const toneClasses = TONE_CLASSES[tone];
  const charCount = countChars(value);
  const isShort = charCount < minLen;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="编辑选题"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-float">
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses.iconBg} ${toneClasses.okText}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </span>
            <h2 className="text-base font-semibold text-neutral-900">编辑选题</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={8}
            className="block w-full resize-y rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base leading-8 text-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="把选题写得更具体一些…"
          />
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
          <span className={`text-xs ${isShort ? 'text-warning-600' : 'text-neutral-500'}`}>
            {charCount} 字{minLen > 0 ? ` · 建议 ≥ ${minLen}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50 cursor-pointer"
            >
              清空
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition-all cursor-pointer ${toneClasses.modalBtn}`}
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
