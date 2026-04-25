import { useRef, useEffect } from 'react';
import { countChars, countParagraphs } from '../constants';

interface TextInputProps {
  /** 输入文本 */
  value: string;
  /** 文本变化回调 */
  onChange: (value: string) => void;
  /** 是否禁用（生成中） */
  disabled?: boolean;
}

/**
 * 文本输入区组件
 * - 大文本框，用于粘贴公众号文章
 * - 显示字数统计和段落识别反馈
 * - 支持拖拽粘贴
 */
export default function TextInput({
  value,
  onChange,
  disabled = false,
}: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = countChars(value);
  const paraCount = countParagraphs(value);
  const hasContent = value.trim().length > 0;

  // 自动调整高度
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 400) + 'px';
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <label
        htmlFor="article-input"
        className="block text-sm font-medium text-neutral-700"
      >
        粘贴公众号文章正文
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
          placeholder="在这里粘贴你的公众号文章正文...&#10;&#10;支持直接从微信公众号编辑器或文章页面复制粘贴"
          rows={6}
          className="
            w-full px-4 pt-4 pb-12 text-[15px] leading-relaxed
            text-neutral-800 placeholder:text-neutral-300
            bg-transparent border-none outline-none resize-none
            disabled:cursor-not-allowed
          "
          aria-describedby="input-stats"
        />

        {/* 底部统计栏 */}
        <div
          id="input-stats"
          className="absolute bottom-0 left-0 right-0 px-4 py-2.5 flex items-center justify-between border-t border-neutral-100 bg-neutral-50/50 rounded-b-2xl"
        >
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            {hasContent ? (
              <>
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                    />
                  </svg>
                  <span>
                    <span className="text-neutral-600 font-medium">
                      {charCount.toLocaleString()}
                    </span>{' '}
                    字
                  </span>
                </span>
                <span className="w-px h-3 bg-neutral-200" />
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
                    />
                  </svg>
                  <span>
                    已识别{' '}
                    <span className="text-neutral-600 font-medium">
                      {paraCount}
                    </span>{' '}
                    个段落
                  </span>
                </span>
              </>
            ) : (
              <span>粘贴文章后将自动识别段落</span>
            )}
          </div>

          {hasContent && !disabled && (
            <button
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
