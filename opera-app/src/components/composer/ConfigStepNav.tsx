export interface ConfigStepState {
  id: string;
  title: string;
  done: boolean;
  active: boolean;
  summary?: string;
}

interface ConfigStepNavProps {
  steps: ConfigStepState[];
  disabled?: boolean;
  onSelect: (id: string) => void;
}

export default function ConfigStepNav({ steps, disabled = false, onSelect }: ConfigStepNavProps) {
  const completedCount = steps.filter((step) => step.done).length;

  return (
    <nav aria-label="创作配置进度" className="border-b border-neutral-200 pb-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-800">创作配置</h2>
        <span className="text-xs font-medium tabular-nums text-neutral-500">
          {completedCount}/{steps.length} 完成
        </span>
      </div>
      <ol className="grid grid-cols-2 gap-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(step.id)}
              aria-current={step.active ? 'step' : undefined}
              className={`flex min-h-14 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                step.active
                  ? 'border-accent-300 bg-accent-50 text-accent-800 ring-1 ring-accent-100'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done
                    ? 'bg-emerald-500 text-white'
                    : step.active
                      ? 'border border-accent-500 bg-white text-accent-700'
                      : 'border border-neutral-300 bg-white text-neutral-400'
                }`}
              >
                {step.done ? '✓' : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{step.title}</span>
                {step.summary && (
                  <span className="mt-0.5 block truncate text-[11px] text-neutral-400">
                    {step.summary}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
