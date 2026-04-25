import { CONTENT_TYPE_OPTIONS } from '../../constants';
import type { ContentType } from '../../types';

interface ContentTypeSelectorProps {
  selected: ContentType | null;
  onSelect: (value: ContentType) => void;
  disabled?: boolean;
}

export default function ContentTypeSelector({
  selected,
  onSelect,
  disabled = false,
}: ContentTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-neutral-700">
          内容类型
        </label>
        <span className="text-xs text-neutral-400">帮助 AI 选择更合适的表达方式</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CONTENT_TYPE_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`
                rounded-2xl border-2 p-3 text-left transition-all duration-200 cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  isSelected
                    ? 'border-primary-400 bg-primary-50/60 text-primary-700 shadow-md shadow-primary-500/5'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }
              `}
            >
              <div className="text-xl mb-1">{option.emoji}</div>
              <div className="text-xs font-semibold mb-1">{option.label}</div>
              <div className="text-[11px] leading-relaxed opacity-80">{option.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
