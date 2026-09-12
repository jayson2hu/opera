import { useId, useRef } from 'react';
import type { DraftWorkspace } from '../../hooks/useDraftWorkspace';
import type { DraftSelection } from '../../lib/draftWorkspace';
import { toast } from '../../lib/toast';

interface Props {
  draft: DraftWorkspace;
  onNew?: () => void;
  onRestore?: (selection: DraftSelection) => void;
  configurationChanged?: boolean;
}
export default function DraftWorkspaceBar({ draft, onNew, onRestore, configurationChanged }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  return (
    <section className="mb-4 rounded-xl border border-neutral-200 bg-white p-3 shadow-card" aria-label="稿件保存与版本">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs">
          <span role="status" className={draft.error ? 'text-red-600' : 'text-emerald-700'}>
            {draft.status === 'saved' ? '✓ 已保存到本机' : draft.status === 'error' ? '⚠ 请检查保存状态' : '正在自动保存…'}
          </span><span className="ml-2 text-neutral-400">独立稿件 · {draft.versions.length} 个版本 · 建议单窗口编辑</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={onNew} disabled={!onNew} className="rounded-lg border border-neutral-200 px-2 py-1.5 hover:bg-neutral-50">新建稿件</button>
          <button type="button" onClick={() => toast(draft.checkpoint() ? '当前版本已留档' : '版本暂存内存，请先导出备份')} className="rounded-lg border border-neutral-200 px-2 py-1.5 hover:bg-neutral-50">保存版本</button>
          <button type="button" onClick={() => dialog.current?.showModal()} className="rounded-lg border border-neutral-200 px-2 py-1.5 hover:bg-neutral-50">版本记录</button>
          <button type="button" onClick={() => { try { draft.exportBackup(); } catch { toast('导出未成功，请先复制正文备份'); } }} className="rounded-lg bg-neutral-800 px-2 py-1.5 text-white">导出稿件备份</button>
        </div>
      </div>
      {configurationChanged && <p className="mt-2 text-xs leading-5 text-primary-700">下一次生成配置已改变；当前稿件保留原来的生成来源，不会被清空。新结果确认后才应用。</p>}
      {draft.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-700">{draft.error}</p>}
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto max-h-[85vh] w-[min(92vw,620px)] overflow-auto rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-800 shadow-float backdrop:bg-black/30">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 id={titleId} className="font-semibold">稿件版本</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="关闭版本记录" className="rounded-lg border px-3 py-1">关闭</button></div>
        <p className="mb-4 text-xs leading-5 text-neutral-500">恢复前先保存当前版本。历史版本不删除；恢复正文及当时的主题、语气、篇幅；模型沿用当前选择，不包含本地临时图片。</p>
        <ul className="space-y-3">{draft.versions.slice().reverse().map((version) => <li key={version.id} className="rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{version.label}</p><p className="text-xs text-neutral-400">{new Date(version.savedAt).toLocaleString()}</p></div>
            <button type="button" disabled={!onRestore} onClick={() => {
              if (!draft.checkpoint('恢复前的稿件')) { toast('当前稿件尚未保存，请先导出备份再恢复'); return; }
              dialog.current?.close(); onRestore?.({ id: draft.id, payload: version.value, restoreVersion: true });
            }} className="shrink-0 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">恢复此版</button></div>
        </li>)}</ul>
      </dialog>
    </section>
  );
}
