import { useEffect, useRef } from 'react';
import type { ProviderId } from '../../types';

interface ModelPopoverProps {
  onClose: () => void;
  provider: ProviderId | null;
  model: string;
  loading?: boolean;
  error?: string | null;
  /** 从顶栏隐藏胶囊（CPU 图标仍可点开） */
  onHideFromHeader: () => void;
}

/**
 * 模型胶囊点击弹层：显示服务商 / 模型 / 状态 + "从顶栏隐藏"按钮 + 配置说明。
 * 点外部 / Esc 关闭。
 */
export default function ModelPopover({
  onClose,
  provider,
  model,
  loading = false,
  error = null,
  onHideFromHeader,
}: ModelPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const status = loading
    ? { label: '加载中', className: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400 animate-pulse' }
    : error
      ? { label: '加载失败', className: 'bg-red-50 text-red-700', dot: 'bg-red-500' }
      : provider
        ? { label: '已连接', className: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
        : { label: '未连接', className: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-300' };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="模型设置"
      className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-neutral-200 bg-white p-4 shadow-float animate-slide-up"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">当前模型</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex justify-between text-neutral-600">
          <dt>服务商</dt>
          <dd className="font-medium text-neutral-900">{provider ?? '未选择'}</dd>
        </div>
        <div className="flex justify-between text-neutral-600">
          <dt>模型</dt>
          <dd className="font-medium text-neutral-900">{model || '未选择'}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
        模型配置请在左侧 Provider 卡片或 opera-server-py/.env 中调整。本弹层仅展示当前状态。
      </p>

      <button
        type="button"
        onClick={onHideFromHeader}
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 cursor-pointer"
      >
        从顶栏隐藏胶囊
      </button>
    </div>
  );
}
