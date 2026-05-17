import CopyButton from './CopyButton';
import { CAPTION_SHORT_THRESHOLD, CAPTION_WARN_THRESHOLD } from '../constants';

interface CaptionProps {
  text: string;
}

export default function Caption({ text }: CaptionProps) {
  if (!text) return null;

  const charCount = text.replace(/\s/g, '').length;
  const formattedCharCount = new Intl.NumberFormat('en-US').format(charCount);
  const isShort = charCount <= CAPTION_SHORT_THRESHOLD;
  const isWarn = charCount > CAPTION_WARN_THRESHOLD;
  const badgeText = isShort ? `${formattedCharCount} 字 · 适合发布` : `${formattedCharCount} 字`;
  const badgeClassName = isWarn
    ? 'border border-warning-500/20 bg-warning-50 text-warning-600'
    : isShort
      ? 'bg-success-50 text-success-500'
      : 'bg-neutral-100 text-neutral-500';

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-primary-600" />
          <h3 className="text-sm font-semibold text-neutral-800">
            发布正文
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassName}`}>
            {badgeText}
          </span>
        </div>
        <CopyButton text={text} label="复制正文" />
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4 transition-all duration-200 hover:shadow-card">
        {isWarn && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning-500/20 bg-warning-50 px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.731 0-2.814-1.874-1.948-3.374L10.052 3.374c.866-1.5 3.03-1.5 3.896 0l7.355 12.752zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span className="text-xs text-warning-600">
              正文超过 800 字可能影响小红书完读率，建议精简或拆分为多篇
            </span>
          </div>
        )}
        <div className="text-sm leading-[1.8] text-neutral-700 whitespace-pre-line">
          {text}
        </div>
      </div>
    </div>
  );
}
