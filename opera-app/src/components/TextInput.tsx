import { useEffect, useRef } from 'react';
import { countChars, countParagraphs } from '../constants';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function TextInput({
  value,
  onChange,
  disabled = false,
  placeholder = '粘贴公众号文章、访谈稿、课程笔记或 HTML 正文。建议保留标题、分段和关键案例，AI 会提炼成适合小红书发布的封面标题、图文卡片、正文和标签。',
}: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = countChars(value);
  const paraCount = countParagraphs(value);
  const hasContent = value.trim().length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [value]);

  return (
    <div className="space-y-2">
      <label
        htmlFor="article-input"
        className="block text-sm font-medium text-neutral-700"
      >
        粘贴原始文章
      </label>

      <div
        className={`
          relative rounded-2xl border-2 transition-all duration-300 overflow-hidden
          ${
            disabled
              ? 'border-neutral-200 bg-neutral-50 opacity-60'
              : hasContent
                ? 'border-primary-300 bg-white shadow-md shadow-primary-500/5 focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:border-primary-400'
                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:shadow-md'
          }
        `}
      >
        <textarea
          ref={textareaRef}
          id="article-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={6}
          className="
            w-full px-4 pt-4 pb-12 text-[15px] leading-relaxed
            text-neutral-800 placeholder:text-neutral-300
            bg-transparent border-none outline-none resize-none
            disabled:cursor-not-allowed
          "
          aria-describedby="input-stats"
        />

        <div
          id="input-stats"
          className="absolute bottom-0 left-0 right-0 px-4 py-2.5 flex items-center justify-between border-t border-neutral-100 bg-neutral-50/50 rounded-b-2xl"
        >
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            {hasContent ? (
              <>
                <span>
                  <span className="text-neutral-600 font-medium">
                    {charCount.toLocaleString()}
                  </span>{' '}
                  字
                </span>
                <span className="w-px h-3 bg-neutral-200" />
                <span>
                  <span className="text-neutral-600 font-medium">
                    {paraCount}
                  </span>{' '}
                  段
                </span>
              </>
            ) : (
              <span>建议粘贴完整正文，生成结果会更稳定。</span>
            )}
          </div>

          {hasContent && !disabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-neutral-400 hover:text-error-500 transition-colors cursor-pointer"
              aria-label="清空输入"
            >
              清空
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
