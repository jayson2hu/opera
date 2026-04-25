import CopyButton from '../CopyButton';
import type { WeChatDraftItem, WeChatDraftStatus } from '../../types';

interface DraftBoxPanelProps {
  drafts: WeChatDraftItem[];
  activeDraftId: string | null;
  currentStatus: WeChatDraftStatus;
  lastSavedAt: string | null;
  canSave: boolean;
  fullText: string;
  onSave: () => void;
  onLoadDraft: (draft: WeChatDraftItem) => void;
}

const STATUS_COPY = {
  not_saved: {
    label: '未保存',
    badgeClass: 'bg-neutral-100 text-neutral-600',
    description: '当前编辑内容尚未进入待发列表。',
  },
  queued: {
    label: '待同步',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    description: '已进入本地草稿箱，后续接入公众号账号后可再同步。',
  },
} as const;

function formatSavedAt(value: string | null): string {
  if (!value) return '尚未保存';
  return value.replace('T', ' ').slice(0, 16);
}

export default function DraftBoxPanel({
  drafts,
  activeDraftId,
  currentStatus,
  lastSavedAt,
  canSave,
  fullText,
  onSave,
  onLoadDraft,
}: DraftBoxPanelProps) {
  const current = STATUS_COPY[currentStatus];

  return (
    <aside className="space-y-4 rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-card">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-800">公众号草稿箱</p>
            <p className="mt-1 text-xs leading-6 text-neutral-500">
              V1 先保存到本地待发区，真实公众号账号接入后再同步到官方草稿箱。
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${current.badgeClass}`}>
            {current.label}
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 text-sm text-neutral-600">
          <p className="font-medium text-neutral-800">当前状态</p>
          <p className="mt-2 leading-6">{current.description}</p>
          <p className="mt-2 text-xs text-neutral-400">最近保存：{formatSavedAt(lastSavedAt)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={canSave
            ? 'inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl cursor-pointer'
            : 'inline-flex items-center justify-center rounded-2xl bg-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-400 cursor-not-allowed'}
        >
          保存到草稿箱
        </button>
        <CopyButton text={fullText} size="md" label="复制待发全文" className="justify-center rounded-2xl px-4 py-3" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-800">最近草稿</p>
          <span className="text-xs text-neutral-400">保留最近 {drafts.length} 篇</span>
        </div>

        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 p-4 text-sm leading-6 text-neutral-500">
            还没有待发草稿。先生成一篇文章，再保存到草稿箱。
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => {
              const isActive = draft.id === activeDraftId;
              return (
                <div
                  key={draft.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    isActive
                      ? 'border-emerald-300 bg-emerald-50/70'
                      : 'border-neutral-200 bg-white/80 hover:border-emerald-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-800">{draft.title || '未命名草稿'}</p>
                      <p className="mt-1 text-xs leading-6 text-neutral-500">{draft.digest || '已保存正文，可稍后继续补充摘要。'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      待同步
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-neutral-400">{formatSavedAt(draft.savedAt)}</span>
                    <div className="flex items-center gap-2">
                      <CopyButton text={[draft.title, draft.digest, draft.body].filter(Boolean).join('\n\n')} size="sm" />
                      <button
                        type="button"
                        onClick={() => onLoadDraft(draft)}
                        className="inline-flex items-center justify-center rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                      >
                        载入继续编辑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
