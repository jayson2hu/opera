import type { ComposerLayoutOptions, ComposerLayoutTemplate } from '../../types';

interface ComposerLayoutPanelProps {
  value: ComposerLayoutOptions;
  onChange: (value: ComposerLayoutOptions) => void;
  disabled?: boolean;
}

const TEMPLATES: Array<{
  id: ComposerLayoutTemplate;
  label: string;
  description: string;
}> = [
  { id: 'clean', label: '清爽分段', description: '短段落' },
  { id: 'list', label: '清单笔记', description: '要点化' },
  { id: 'story', label: '故事种草', description: '有起承转合' },
  { id: 'tutorial', label: '教程步骤', description: '步骤清晰' },
];

export default function ComposerLayoutPanel({ value, onChange, disabled = false }: ComposerLayoutPanelProps) {
  const update = (patch: Partial<ComposerLayoutOptions>) => onChange({ ...value, ...patch });

  return (
    <section className="bg-white rounded-2xl border border-accent-200/70 p-4 shadow-card shadow-accent-500/5 space-y-4 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-accent-600 uppercase tracking-wide">小红书排版</div>
          <div className="text-xs text-neutral-400 mt-1">选择复制前的正文结构</div>
        </div>
        <div className="text-xs text-neutral-400">预览会同步更新</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {TEMPLATES.map((template) => {
          const active = value.template === template.id;
          return (
            <button
              key={template.id}
              type="button"
              disabled={disabled}
              onClick={() => update({ template: template.id })}
              className={
                active
                  ? 'min-h-[68px] rounded-xl border border-accent-500 bg-accent-50 px-3 py-2 text-left shadow-sm shadow-accent-500/10 transition-all'
                  : 'min-h-[68px] rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left hover:border-accent-200 hover:bg-white transition-all disabled:opacity-60'
              }
            >
              <span className={active ? 'block text-sm font-semibold text-accent-700' : 'block text-sm font-semibold text-neutral-700'}>
                {template.label}
              </span>
              <span className={active ? 'block text-xs text-accent-500 mt-1' : 'block text-xs text-neutral-400 mt-1'}>
                {template.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={value.useEmoji}
            disabled={disabled}
            onChange={(event) => update({ useEmoji: event.target.checked })}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          表情强调
        </label>
        <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={value.useDividers}
            disabled={disabled}
            onChange={(event) => update({ useDividers: event.target.checked })}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          分隔线
        </label>
        <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={value.keepTagsAtEnd}
            disabled={disabled}
            onChange={(event) => update({ keepTagsAtEnd: event.target.checked })}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          标签置底
        </label>
      </div>
    </section>
  );
}

