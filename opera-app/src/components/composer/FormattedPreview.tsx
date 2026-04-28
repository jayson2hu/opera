import CopyButton from '../CopyButton';

interface FormattedPreviewProps {
  text: string;
}

export default function FormattedPreview({ text }: FormattedPreviewProps) {
  const hasText = text.trim().length > 0;

  return (
    <section className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-card space-y-3 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">格式化预览</div>
          <div className="text-xs text-neutral-400 mt-1">复制按钮会使用这里的内容</div>
        </div>
        <CopyButton text={text} size="sm" />
      </div>

      <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
        {hasText ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-neutral-700">{text}</pre>
        ) : (
          <div className="text-sm text-neutral-300">生成或编辑正文后会显示预览</div>
        )}
      </div>
    </section>
  );
}

