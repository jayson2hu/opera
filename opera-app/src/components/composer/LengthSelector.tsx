import { LENGTH_OPTIONS } from '../../constants';
import type { TargetLength } from '../../types';

interface LengthSelectorProps {
  selected: TargetLength;
  onSelect: (value: TargetLength) => void;
  disabled?: boolean;
}

export default function LengthSelector({
  selected,
  onSelect,
  disabled = false,
}: LengthSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-neutral-700">
          字数目标
        </label>
        <span className="text-xs text-neutral-400">默认中等长度，可按需切换</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {LENGTH_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              disabled={disabled}
              className={
                isSelected
                  ? 'rounded-full px-4 py-1.5 bg-primary-500 text-white text-xs font-medium cursor-pointer disabled:cursor-not-allowed'
                  : 'rounded-full px-4 py-1.5 border border-neutral-200 text-neutral-500 text-xs hover:border-neutral-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
