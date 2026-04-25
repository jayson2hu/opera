import { countChars } from '../../constants';
import CopyButton from '../CopyButton';

interface EditableDigestProps {
  value: string;
  onChange: (value: string) => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
  disabled?: boolean;
}

export default function EditableDigest({
  value,
  onChange,
  onRegenerate,
  canRegenerate,
  disabled = false,
}: EditableDigestProps) {
  const charCount = countChars(value);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-card space-y-3 animate-slide-up">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
          摘要
        </span>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>{charCount} 字</span>
          <CopyButton text={value} size="sm" />
          <button
            type="button"
            onClick={onRegenerate}
            disabled={!canRegenerate || disabled}
            title="重新生成摘要"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↺
          </button>
        </div>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 180))}
        placeholder="用于公众号封面导语或草稿摘要的短文案"
        disabled={disabled}
        className="w-full min-h-[108px] resize-none bg-transparent text-sm leading-7 text-neutral-700 outline-none placeholder:text-neutral-300 disabled:cursor-not-allowed"
      />

      <p className="text-xs leading-6 text-neutral-400">
        建议控制在 60-120 字，适合作为封面摘要、文章导语或草稿箱说明。
      </p>
    </div>
  );
}
