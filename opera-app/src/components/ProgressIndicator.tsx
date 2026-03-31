import type { GenerationStep } from '../types';
import { GENERATION_STEPS } from '../constants';

interface ProgressIndicatorProps {
  /** 当前步骤 */
  currentStep: GenerationStep;
  /** 是否正在生成 */
  isGenerating: boolean;
}

/**
 * 进度指示器组件
 * - 分步骤展示生成进度
 * - 当前步骤有动画脉冲效果
 * - 已完成步骤显示勾选标记
 */
export default function ProgressIndicator({
  currentStep,
  isGenerating,
}: ProgressIndicatorProps) {
  if (!isGenerating && currentStep === 'done') return null;

  const currentIndex = GENERATION_STEPS.findIndex(
    (s) => s.id === currentStep
  );

  return (
    <div className="animate-fade-in">
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-card">
        {/* 顶部文案 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex items-center justify-center w-5 h-5">
            <div className="absolute w-5 h-5 rounded-full bg-primary-400/20 animate-pulse-gentle" />
            <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
          </div>
          <span className="text-sm font-medium text-neutral-700">
            {GENERATION_STEPS[currentIndex]?.description ?? '准备中...'}
          </span>
        </div>

        {/* 步骤条 */}
        <div className="flex items-center gap-1">
          {GENERATION_STEPS.filter((s) => s.id !== 'done').map((step, i) => {
            const isDone = i < currentIndex;
            const isCurrent = i === currentIndex;

            return (
              <div key={step.id} className="flex-1 flex flex-col items-center gap-1.5">
                {/* 进度条段 */}
                <div
                  className={`
                    h-1.5 w-full rounded-full transition-all duration-500
                    ${
                      isDone
                        ? 'bg-primary-500'
                        : isCurrent
                          ? 'bg-gradient-to-r from-primary-500 to-primary-200 animate-pulse-gentle'
                          : 'bg-neutral-100'
                    }
                  `}
                />
                {/* 步骤名 */}
                <span
                  className={`
                    text-[10px] font-medium transition-colors
                    ${
                      isDone
                        ? 'text-primary-500'
                        : isCurrent
                          ? 'text-primary-600'
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
