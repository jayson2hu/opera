import CopyButton from './CopyButton';

interface CaptionProps {
  text: string;
}

export default function Caption({ text }: CaptionProps) {
  if (!text) return null;

  const charCount = text.replace(/\s/g, '').length;

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-primary-600" />
          <h3 className="text-sm font-semibold text-neutral-800">
            发布正文
          </h3>
          <span className="text-xs text-neutral-400">{charCount} 字</span>
        </div>
        <CopyButton text={text} label="复制正文" />
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4 transition-all duration-200 hover:shadow-card">
        <div className="text-sm leading-[1.8] text-neutral-700 whitespace-pre-line">
          {text}
        </div>
      </div>
    </div>
  );
}
