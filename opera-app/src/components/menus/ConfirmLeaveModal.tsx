import { useRef } from 'react';
import type { FlowKind } from '../../types';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';

interface ConfirmLeaveModalProps {
  /** 当前所在流程，用于在文案里显示具体名称 */
  fromKind: FlowKind;
  /** 是否检测到 localStorage 里有当前流程的自动保存草稿 */
  hasSavedDraft: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const FLOW_NAME: Record<FlowKind, string> = {
  wechat: '写公众号',
  adapter: '改写成小红书',
  composer: '写小红书',
};

/**
 * 离开流程页确认弹窗。
 * - 文案承诺自动保存到草稿箱可恢复（基于 useAutoSaveDraft 1.5s 防抖机制）
 * - Esc / 点遮罩 = 取消
 */
export default function ConfirmLeaveModal({ fromKind, hasSavedDraft, onCancel, onConfirm }: ConfirmLeaveModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(dialogRef, onCancel);

  return (
    <div
      role="dialog"
      ref={dialogRef}
      tabIndex={-1}
      aria-modal="true"
      aria-label="离开确认"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade-in"
    >
      <div aria-hidden="true" onClick={onCancel} className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-float">
        <div className="px-6 pt-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50">
            <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h2 className="mt-3 text-lg font-bold text-neutral-900">返回首页？</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
            你正在「{FLOW_NAME[fromKind]}」页。
            {hasSavedDraft ? (
              <>
                <br />
                当前内容已<span className="font-semibold text-primary-700">自动保存到草稿箱</span>，
                可从首页「继续上次」或顶栏头像 → 我的草稿箱恢复。
              </>
            ) : (
              <>
                <br />
                还没有可保存的内容，直接返回即可。
              </>
            )}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/40 px-6 py-3">
          <button
            type="button"
            onClick={onCancel}
            data-autofocus
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 cursor-pointer"
          >
            继续编辑
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600 cursor-pointer"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
