import { useState } from 'react';
import CopyButton from '../CopyButton';

interface EditableTagsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
  disabled?: boolean;
}

export default function EditableTags({
  tags,
  onChange,
  onRegenerate,
  canRegenerate,
  disabled = false,
}: EditableTagsProps) {
  const [draftTag, setDraftTag] = useState('');


  const commitDraft = () => {
    const nextTag = draftTag.trim().replace(/^#+/, '');
    if (!nextTag || tags.includes(nextTag)) {
      setDraftTag('');
      return;
    }
    onChange([...tags, nextTag]);
    setDraftTag('');
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-card space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
          标签
        </span>
        <div className="flex items-center gap-2">
          <CopyButton
            text={tags.map((tag) => `#${tag}`).join(' ')}
            size="sm"
            label="复制"
          />
          <button
            type="button"
            onClick={onRegenerate}
            disabled={!canRegenerate || disabled}
            title="重新生成标签"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 text-neutral-400 hover:text-accent-600 hover:border-accent-300 hover:bg-accent-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↺
          </button>
        </div>
      </div>


      <div className="flex flex-wrap gap-2 items-center">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent-50 text-accent-600 text-xs font-medium"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((item) => item !== tag))}
              className="text-accent-400 hover:text-accent-600 cursor-pointer"
              aria-label={`删除标签 ${tag}`}
            >
              ×
            </button>
          </span>
        ))}

        <input
          value={draftTag}
          onChange={(event) => setDraftTag(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commitDraft();
            }
          }}
          placeholder="+ 添加标签"
          disabled={disabled}
          className="min-w-[120px] flex-1 text-xs text-neutral-600 outline-none placeholder:text-neutral-300 disabled:cursor-not-allowed disabled:text-neutral-300"
        />

      </div>
    </div>
  );
}
