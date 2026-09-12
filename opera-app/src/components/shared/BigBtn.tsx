import type { ReactNode } from 'react';
import type { CfgTone } from './CfgGroup';

interface BigBtnProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: CfgTone;
  children: ReactNode;
}

const TONE: Record<CfgTone, string> = {
  primary:
    'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20 hover:shadow-glow-primary hover:scale-[1.01] active:scale-[0.99]',
  accent:
    'bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-md shadow-accent-500/20 hover:shadow-glow-accent hover:scale-[1.01] active:scale-[0.99]',
  emerald:
    'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 hover:shadow-glow-emerald hover:scale-[1.01] active:scale-[0.99]',
};

/**
 * 左栏底部生成大按钮。disabled 时灰白；loading 时显示旋转 + 文案。
 */
export default function BigBtn({ onClick, disabled = false, loading = false, tone = 'primary', children }: BigBtnProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`
        relative inline-flex w-full items-center justify-center gap-2 rounded-2xl
        px-6 py-3 text-sm font-semibold transition-all duration-300 cursor-pointer select-none
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
        ${isDisabled ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : TONE[tone]}
      `}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
      )}
      <span>{children}</span>
    </button>
  );
}
