import type { CfgTone } from './CfgGroup';

export interface ChipOption<T extends string> {
  id: T;
  emoji: string;
  label: string;
  /** 副标题徽标，如 "Knowledge" / "BFF" */
  subtitle?: string;
  /** 详情卡正文（始终展示当前选中项） */
  description: string;
  /** 详情卡可选引用（语气示例句） */
  example?: string;
}

interface ChipPickerProps<T extends string> {
  options: ChipOption<T>[];
  selected: T | null;
  onSelect: (id: T) => void;
  disabled?: boolean;
  tone: CfgTone;
  /** 可访问标签（fieldset 用） */
  ariaLabel?: string;
}

interface ToneStyles {
  chipActive: string;
  chipIdle: string;
  detailBg: string;
  detailBorder: string;
  detailTitle: string;
  subtitleTag: string;
  emptyHint: string;
  emptyBorder: string;
}

const TONE_MAP: Record<CfgTone, ToneStyles> = {
  primary: {
    chipActive: 'bg-primary-500 text-white shadow-card border-primary-500',
    chipIdle: 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700',
    detailBg: 'bg-primary-50/60',
    detailBorder: 'border-primary-200',
    detailTitle: 'text-primary-800',
    subtitleTag: 'bg-primary-100 text-primary-700',
    emptyHint: 'text-primary-400',
    emptyBorder: 'border-primary-200/60',
  },
  accent: {
    chipActive: 'bg-accent-500 text-white shadow-card border-accent-500',
    chipIdle: 'bg-white text-neutral-600 border-neutral-200 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700',
    detailBg: 'bg-accent-50/60',
    detailBorder: 'border-accent-200',
    detailTitle: 'text-accent-800',
    subtitleTag: 'bg-accent-100 text-accent-700',
    emptyHint: 'text-accent-400',
    emptyBorder: 'border-accent-200/60',
  },
  emerald: {
    chipActive: 'bg-emerald-500 text-white shadow-card border-emerald-500',
    chipIdle: 'bg-white text-neutral-600 border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
    detailBg: 'bg-emerald-50/60',
    detailBorder: 'border-emerald-200',
    detailTitle: 'text-emerald-800',
    subtitleTag: 'bg-emerald-100 text-emerald-700',
    emptyHint: 'text-emerald-400',
    emptyBorder: 'border-emerald-200/60',
  },
};

/**
 * 芯片 + 详情卡选择器。
 *
 * - 芯片排：flex-wrap 自动换行；选中态填充 tone 主色，未选中白底带 hover
 * - 详情卡：始终展示当前选中项的完整描述（含可选 subtitle 徽标 + example 引用）
 * - 未选中态：dashed 占位卡「请选择上方任一项查看详情」
 */
export default function ChipPicker<T extends string>({
  options,
  selected,
  onSelect,
  disabled = false,
  tone,
  ariaLabel,
}: ChipPickerProps<T>) {
  const toneClasses = TONE_MAP[tone];
  const current = options.find((opt) => opt.id === selected) ?? null;

  return (
    <div className="space-y-2.5" role="group" aria-label={ariaLabel}>
      {/* 芯片排 */}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = option.id === selected;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`
                inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] font-medium
                transition-all duration-200 cursor-pointer select-none
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                disabled:opacity-60 disabled:cursor-not-allowed
                ${isSelected ? toneClasses.chipActive : toneClasses.chipIdle}
              `}
            >
              <span aria-hidden="true">{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* 详情卡 / 未选占位 */}
      {current ? (
        <div className={`rounded-xl border p-3 ${toneClasses.detailBg} ${toneClasses.detailBorder}`}>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-base">{current.emoji}</span>
            <span className={`text-sm font-semibold ${toneClasses.detailTitle}`}>{current.label}</span>
            {current.subtitle && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClasses.subtitleTag}`}>
                {current.subtitle}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-600">{current.description}</p>
          {current.example && (
            <p className="mt-1 text-[11px] italic text-neutral-400">"{current.example}"</p>
          )}
        </div>
      ) : (
        <div className={`rounded-xl border border-dashed p-3 ${toneClasses.emptyBorder}`}>
          <p className={`text-[11px] ${toneClasses.emptyHint}`}>
            请选择上方任一项查看详情
          </p>
        </div>
      )}
    </div>
  );
}
