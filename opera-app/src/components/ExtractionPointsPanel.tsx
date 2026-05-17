import { useMemo, useState } from 'react';

interface ExtractionPointsPanelProps {
  points: string[];
  onConfirm: (selectedPoints: string[]) => void;
  onCancel: () => void;
}

export default function ExtractionPointsPanel({
  points,
  onConfirm,
  onCancel,
}: ExtractionPointsPanelProps) {
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(
    () => new Set(points.map((_, index) => index)),
  );
  const selectedPoints = useMemo(
    () => points.filter((_, index) => checkedIndices.has(index)),
    [checkedIndices, points],
  );
  const canContinue = selectedPoints.length >= 3;
  const isAllSelected = checkedIndices.size === points.length;

  const togglePoint = (index: number) => {
    setCheckedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setCheckedIndices(isAllSelected ? new Set() : new Set(points.map((_, index) => index)));
  };

  return (
    <section className="animate-slide-up rounded-2xl border-2 border-primary-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100">
            <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
              />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">AI 提取了 {points.length} 个核心观点</h3>
            <p className="text-xs text-neutral-400">取消不需要的观点，再继续生成</p>
          </div>
        </div>
        <span className="text-xs font-medium text-primary-600">
          已选 {selectedPoints.length} / {points.length}
        </span>
      </div>

      <div className="mb-5 space-y-2">
        {points.map((point, index) => {
          const isChecked = checkedIndices.has(index);
          return (
            <button
              key={`${point}-${index}`}
              type="button"
              onClick={() => togglePoint(index)}
              className={`
                flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                ${isChecked ? 'border-neutral-200 bg-white' : 'border-neutral-100 bg-neutral-50/50 opacity-60'}
              `}
            >
              <span
                className={`
                  mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2
                  ${isChecked ? 'border-primary-500 bg-primary-500' : 'border-neutral-300 bg-white'}
                `}
              >
                {isChecked && (
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </span>
              <span className={`text-sm leading-relaxed ${isChecked ? 'text-neutral-700' : 'text-neutral-400 line-through'}`}>
                {point}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={toggleAll}
          className="self-start text-xs text-neutral-500 transition-colors hover:text-primary-600"
        >
          全选/取消全选
        </button>
        <div className="flex flex-col gap-2 sm:items-end">
          {!canContinue && <span className="text-xs text-warning-600">至少选择 3 个观点</span>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => onConfirm(selectedPoints)}
              className={`
                inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium shadow-md transition-all
                ${canContinue
                  ? 'bg-primary-500 text-white shadow-primary-500/20 hover:bg-primary-600 cursor-pointer'
                  : 'bg-neutral-200 text-neutral-400 shadow-none cursor-not-allowed'
                }
              `}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                />
              </svg>
              继续生成
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
