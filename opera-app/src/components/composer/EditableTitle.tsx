import CopyButton from '../CopyButton';

interface EditableTitleProps {
  value: string;
  onChange: (value: string) => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
  disabled?: boolean;
  label?: string;
  maxLength?: number;
  tone?: 'primary' | 'accent';
}

const TONE_STYLES = {
  primary: 'hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50',
  accent: 'hover:text-accent-600 hover:border-accent-300 hover:bg-accent-50',
} as const;

export default function EditableTitle({
  value,
  onChange,
  onRegenerate,
  canRegenerate,
  disabled = false,
  label = '标题',
  maxLength = 25,
  tone = 'accent',
}: EditableTitleProps) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-card space-y-3 animate-slide-up">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <CopyButton text={value} size="sm" />
          <button
            type="button"
            onClick={onRegenerate}
            disabled={!canRegenerate || disabled}
            title={`重新生成${label}`}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 text-neutral-400 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${TONE_STYLES[tone]}`}
          >
            ↺
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
          placeholder={`${label}生成后可直接修改`}
          disabled={disabled}
          className="w-full text-base font-semibold text-neutral-800 border-0 outline-none bg-transparent placeholder:text-neutral-300 disabled:cursor-not-allowed"
        />
        <div className="text-right text-xs text-neutral-300">{value.length}/{maxLength}</div>
      </div>
    </div>
  );
}
