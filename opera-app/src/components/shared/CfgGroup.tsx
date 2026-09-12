import type { ReactNode } from 'react';

export type CfgTone = 'primary' | 'accent' | 'emerald';

interface CfgGroupProps {
  /** 步骤序号 1-9 */
  step: number;
  title: string;
  tone?: CfgTone;
  /** 右上角辅助文案 */
  hint?: string;
  children: ReactNode;
}

const TONE: Record<CfgTone, { badge: string; ring: string }> = {
  primary: { badge: 'bg-primary-100 text-primary-700', ring: 'ring-primary-500/15' },
  accent: { badge: 'bg-accent-100 text-accent-700', ring: 'ring-accent-500/15' },
  emerald: { badge: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-500/15' },
};

/**
 * 左栏配置分组：step 数字徽章 + 标题 + slot 内容。
 * 通用容器，供三个流程页左栏复用。
 */
export default function CfgGroup({ step, title, tone = 'primary', hint, children }: CfgGroupProps) {
  const toneClasses = TONE[tone];
  return (
    <section className="space-y-2.5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ring-1 ${toneClasses.badge} ${toneClasses.ring}`}
          >
            {step}
          </span>
          <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        </div>
        {hint && <span className="text-[11px] text-neutral-400">{hint}</span>}
      </header>
      <div>{children}</div>
    </section>
  );
}
