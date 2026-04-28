import type { ChangeEvent } from 'react';
import type { ComposerDraftImage } from '../../types';

interface ImageSuggestionProps {
  keywords: string[];
  images: ComposerDraftImage[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export default function ImageSuggestion({
  keywords,
  images,
  onAddImages,
  onRemoveImage,
  error = null,
  disabled = false,
}: ImageSuggestionProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onAddImages(files);
    event.target.value = '';
  };

  return (
    <div className="bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 p-4 space-y-4 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-neutral-500">配图管理</div>
          <div className="text-xs text-neutral-400 mt-1">最多 9 张，支持 PNG/JPG/WebP</div>
        </div>
        <label
          className={
            disabled
              ? 'inline-flex items-center rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-300 cursor-not-allowed'
              : 'inline-flex items-center rounded-xl border border-accent-200 bg-white px-3 py-2 text-xs font-medium text-accent-600 hover:border-accent-300 hover:bg-accent-50 cursor-pointer transition-all'
          }
        >
          添加图片
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            disabled={disabled}
            onChange={handleChange}
            className="sr-only"
          />
        </label>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((image, index) => (
            <div key={image.id} className="group overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <div className="aspect-square bg-neutral-100">
                <img src={image.previewUrl} alt={image.alt ?? image.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-neutral-600">{image.name}</div>
                  <div className="text-[11px] text-neutral-400">图片 {index + 1}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveImage(image.id)}
                  disabled={disabled}
                  className="shrink-0 rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-neutral-400">AI 配图关键词</div>
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
      </div>
    </div>
  );
}
