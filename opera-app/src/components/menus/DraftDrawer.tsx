import { useRef, type RefObject } from 'react';
import { deleteDraft, useRecentDrafts } from '../../hooks/useRecentDrafts';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import type { FlowKind } from '../../types';
import { toast } from '../../lib/toast';

interface DraftDrawerProps {
  onClose: () => void;
  onRestore: (kind: FlowKind, payload: unknown, id?: string) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * 草稿箱右侧抽屉：列出所有 opera-draft-* 草稿，每条带"恢复 / 删除"。
 * 宽 380px。
 */
export default function DraftDrawer({ onClose, onRestore, returnFocusRef }: DraftDrawerProps) {
  const drafts = useRecentDrafts(Number.MAX_SAFE_INTEGER);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(dialogRef, onClose, { returnFocusRef });

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="我的草稿箱" className="fixed inset-0 z-[80]">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-neutral-900/30" />
      <aside className="absolute right-0 top-0 flex h-full w-[380px] max-w-full flex-col overflow-hidden border-l border-neutral-200 bg-white shadow-float animate-slide-up">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">我的草稿箱</h2>
            <p className="text-[11px] text-neutral-400">{drafts.length} 个本地草稿</p>
          </div>
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

        <div className="flex-1 overflow-y-auto p-4">
          {drafts.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">📂</div>
              <p className="mt-3 text-sm text-neutral-500">还没有草稿</p>
              <p className="mt-1 text-xs text-neutral-400">在三个流程页持续输入后会自动保存</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-card transition-all hover:border-neutral-300"
                >
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-lg">
                    {draft.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-800">{draft.title}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">{draft.meta}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onRestore(draft.kind, draft.payload, draft.id);
                          onClose();
                        }}
                        className="rounded-md bg-primary-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-primary-600 cursor-pointer"
                      >
                        恢复
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm('删除这篇本地稿件及其版本记录？此操作不能撤销，请先导出需要的内容。')) return;
                          toast(deleteDraft(draft.id) ? '草稿已删除' : '删除失败，原稿未改动');
                        }}
                        className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-neutral-50 cursor-pointer"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
