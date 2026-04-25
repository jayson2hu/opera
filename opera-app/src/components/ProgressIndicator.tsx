import type { StepConfig } from '../types';

interface ProgressIndicatorProps {
  /** 当前步骤 */
  currentStep: string;
  /** 是否正在生成 */
  isGenerating: boolean;
  /** 步骤配置 */
  steps: StepConfig[];
  /** 主题色 */
  tone?: 'primary' | 'accent';
}

const PALETTE = {
  primary: {
    pulse: 'bg-primary-400/20',
    dot: 'bg-primary-500',
    doneBar: 'bg-primary-500',
    currentBar: 'bg-gradient-to-r from-primary-500 to-primary-200 animate-pulse-gentle',
    doneText: 'text-primary-500',
    currentText: 'text-primary-600',
  },
  accent: {
    pulse: 'bg-accent-400/20',
    dot: 'bg-accent-500',
    doneBar: 'bg-accent-500',
    currentBar: 'bg-gradient-to-r from-accent-500 to-accent-200 animate-pulse-gentle',
    doneText: 'text-accent-500',
    currentText: 'text-accent-600',
  },
} as const;

/**
 * 进度指示器组件
 * - 分步骤展示生成进度
 * - 当前步骤有动画脉冲效果
 * - 支持适配器 / 创作两种流程
 */
export default function ProgressIndicator({
  currentStep,
  isGenerating,
  steps,
  tone = 'primary',
}: ProgressIndicatorProps) {
  if (!steps.length) return null;
  if (!isGenerating && currentStep === 'done') return null;

  const palette = PALETTE[tone];
  const resolvedIndex = steps.findIndex((step) => step.id === currentStep);
  const currentIndex = resolvedIndex >= 0 ? resolvedIndex : 0;

  return (
    <div className="animate-fade-in">
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex items-center justify-center w-5 h-5">
            <div className={`absolute w-5 h-5 rounded-full ${palette.pulse}`} />
            <div className={`w-2.5 h-2.5 rounded-full ${palette.dot}`} />
          </div>
          <span className="text-sm font-medium text-neutral-700">
            {steps[currentIndex]?.description ?? '准备中...'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {steps.filter((step) => step.id !== 'done').map((step, index) => {
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={step.id} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`
                    h-1.5 w-full rounded-full transition-all duration-500
                    ${
                      isDone
                        ? palette.doneBar
                        : isCurrent
                          ? palette.currentBar
                          : 'bg-neutral-100'
                    }
                  `}
                />
                <span
                  className={`
                    text-[10px] font-medium transition-colors
                    ${
                      isDone
                        ? palette.doneText
                        : isCurrent
                          ? palette.currentText
                          : 'text-neutral-300'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
