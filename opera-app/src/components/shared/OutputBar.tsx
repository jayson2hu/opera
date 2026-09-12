import type { ReactNode } from 'react';

export type OutputStatus = 'idle' | 'generating' | 'paused' | 'done' | 'error';

interface OutputBarProps {
  status: OutputStatus;
  /** 状态胶囊右侧的操作提示文字 */
  hint?: string;
  /** 右侧操作按钮（如 复制 / 保存草稿） */
  actions?: ReactNode;
}

const STATUS_META: Record<OutputStatus, { label: string; dot: string; text: string }> = {
  idle: { label: '待生成', dot: 'bg-neutral-300', text: 'text-neutral-500' },
  generating: { label: '生成中…', dot: 'bg-primary-500 animate-pulse-gentle', text: 'text-primary-700' },
  paused: { label: '等待确认', dot: 'bg-primary-500 animate-pulse-gentle', text: 'text-primary-700' },
  done: { label: '✓ 生成完成', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  error: { label: '生成失败', dot: 'bg-error-500', text: 'text-error-500' },
};

const STATUS_BG: Record<OutputStatus, string> = {
  idle: 'bg-neutral-100',
  generating: 'bg-primary-50',
  paused: 'bg-primary-50',
  done: 'bg-emerald-50',
  error: 'bg-error-50',
};

export default function OutputBar({ status, hint, actions }: OutputBarProps) {
  const meta = STATUS_META[status];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BG[status]} ${meta.text}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        {hint && <span className="text-xs text-neutral-500 truncate">{hint}</span>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
