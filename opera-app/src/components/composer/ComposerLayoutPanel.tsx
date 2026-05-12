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
  preview: string[];
}> = [
  { id: 'clean', label: '简洁段落', description: '短段落留白', preview: ['核心观点', '补充说明', '行动建议'] },
  { id: 'list', label: '清单结构', description: '要点更醒目', preview: ['✅ 要点一', '✅ 要点二', '✅ 要点三'] },
  { id: 'story', label: '故事转折', description: '适合经验复盘', preview: ['💡 背景', '🔄 转折', '⭐ 收获'] },
  { id: 'tutorial', label: '步骤教程', description: '适合操作指南', preview: ['Step 1: ...', 'Step 2: ...', 'Step 3: ...'] },
];

export default function ComposerLayoutPanel({ value, onChange, disabled = false }: ComposerLayoutPanelProps) {
  const update = (patch: Partial<ComposerLayoutOptions>) => onChange({ ...value, ...patch });

  return (
    <section className="bg-white rounded-2xl border border-accent-200/70 p-4 shadow-card shadow-accent-500/5 space-y-4 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-accent-600 uppercase tracking-wide">排版结构</div>
          <div className="mt-1 text-xs text-neutral-400">选择适合发布场景的正文组织方式。</div>
        </div>
        <div className="text-xs text-neutral-400">预览会同步影响最终复制文本</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {TEMPLATES.map((template) => {
          const active = value.template === template.id;
          return (
            <button
              key={template.id}
              type="button"
              disabled={disabled}
              onClick={() => update({ template: template.id })}
              aria-pressed={active}
              className={
                active
                  ? 'min-h-[132px] rounded-xl border border-accent-500 bg-accent-50 px-3 py-3 text-left shadow-sm shadow-accent-500/10 transition-all'
                  : 'min-h-[132px] rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-left hover:border-accent-200 hover:bg-white transition-all disabled:opacity-60'
              }
            >
              <span className={active ? 'block text-sm font-semibold text-accent-700' : 'block text-sm font-semibold text-neutral-700'}>
                {template.label}
              </span>
              <span className={active ? 'block text-xs text-accent-500 mt-1' : 'block text-xs text-neutral-400 mt-1'}>
                {template.description}
              </span>
              <span
                className={`
                  mt-3 block rounded-lg border px-2 py-1.5 text-[11px] leading-5 whitespace-pre-line
                  ${
                    active
                      ? 'border-accent-200 bg-white/80 text-accent-700'
                      : 'border-neutral-200 bg-white text-neutral-400'
                  }
                `}
              >
                {template.preview.join('\n')}
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
          使用 emoji
        </label>
        <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={value.useDividers}
            disabled={disabled}
            onChange={(event) => update({ useDividers: event.target.checked })}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          添加分隔线
        </label>
        <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={value.keepTagsAtEnd}
            disabled={disabled}
            onChange={(event) => update({ keepTagsAtEnd: event.target.checked })}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          标签放末尾
        </label>
      </div>
    </section>
  );
}
