import { useRef, type RefObject } from 'react';
import { useRecentDrafts } from '../../hooks/useRecentDrafts';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';

interface ProfileModalProps {
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * 展示本地工作台和浏览器草稿的真实状态。
 */
export default function ProfileModal({ onClose, returnFocusRef }: ProfileModalProps) {
  const draftCount = useRecentDrafts(Number.MAX_SAFE_INTEGER).length;
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(dialogRef, onClose, { returnFocusRef });

  return (
    <div
      role="dialog"
      ref={dialogRef}
      tabIndex={-1}
      aria-modal="true"
      aria-label="工作台状态"
      className="fixed inset-0 z-[85] flex items-center justify-center p-4 animate-fade-in"
    >
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-float">
        <header className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">工作台状态</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            data-autofocus
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="bg-gradient-to-br from-accent-400 via-accent-500 to-primary-400 px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-xl font-bold backdrop-blur">
              创
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">本地工作台</span>
                <span className="rounded bg-white/25 px-1.5 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur">LOCAL</span>
              </div>
              <div className="truncate text-xs opacity-85">未登录 · 无云端账号</div>
              <div className="mt-1 text-[11px] opacity-75">Opera 工作台 · 数据保存在当前浏览器</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3">
            <h3 className="text-xs font-semibold text-neutral-700">本地草稿</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
              当前浏览器已保存 {draftCount} 个草稿。草稿不会上传到云端，清理浏览器数据后可能丢失。
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3">
            <h3 className="text-xs font-semibold text-neutral-700">数据范围</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
              草稿和偏好只在当前浏览器中可用，更换设备或浏览器不会自动同步。
            </p>
          </div>
        </div>

        <div className="border-t border-neutral-100 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600 cursor-pointer"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
