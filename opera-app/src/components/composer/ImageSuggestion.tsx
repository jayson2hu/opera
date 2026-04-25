interface ImageSuggestionProps {
  keywords: string[];
}

export default function ImageSuggestion({ keywords }: ImageSuggestionProps) {
  return (
    <div className="bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 p-4 space-y-3 animate-slide-up">
      <div className="text-xs font-medium text-neutral-400">配图建议</div>
      <div className="flex flex-wrap gap-2">
        {keywords.length > 0 ? (
          keywords.map((keyword) => (
            <span
              key={keyword}
              className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-600"
            >
              {keyword}
            </span>
          ))
        ) : (
          <span className="text-xs text-neutral-300">生成后会提供 3-5 个配图关键词</span>
        )}
      </div>
      <button
        type="button"
        disabled
        title="图片上传功能即将支持"
        className="mt-1 inline-flex items-center gap-1.5 text-xs text-neutral-300 cursor-not-allowed"
      >
        <span>上传图片（即将支持）</span>
      </button>
    </div>
  );
}
