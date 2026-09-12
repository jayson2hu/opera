import { useId } from 'react';
import { candidateText } from '../../lib/generationCandidate';
interface Props { original: unknown; candidate: unknown; stale: boolean; onApply: () => void; onDiscard: () => void }
export default function GenerationReview({ original, candidate, stale, onApply, onDiscard }: Props) {
  const id = useId();
  return <section aria-labelledby={id} className="mb-4 rounded-xl border border-primary-200 bg-primary-50/60 p-4">
    <h2 id={id} className="text-sm font-semibold text-neutral-800">新内容已生成，确认后再应用</h2>
    <p className="mt-1 text-xs text-neutral-500">当前稿件未被覆盖。候选确认后才保存，离开此稿件会丢弃未确认候选；应用后可继续手工编辑，原稿留在版本记录中。</p>
    {stale && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">生成期间稿件已改变，候选已过期。请放弃后基于最新内容重新生成。</p>}
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <details className="min-w-0 rounded-lg border border-neutral-200 bg-white p-3"><summary className="cursor-pointer text-xs text-neutral-500">请求时的原稿</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-6 text-neutral-600">{candidateText(original)}</pre></details>
      <details open className="min-w-0 rounded-lg border border-emerald-200 bg-white p-3"><summary className="cursor-pointer text-xs text-emerald-700">新候选</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-6 text-neutral-700">{candidateText(candidate)}</pre></details>
    </div>
    <div className="mt-3 flex justify-end gap-2 text-xs">
      <button type="button" onClick={onDiscard} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">放弃候选</button>
      <button type="button" onClick={onApply} disabled={stale} className="rounded-lg bg-primary-600 px-3 py-2 text-white disabled:opacity-40">应用并留存版本</button>
    </div>
  </section>;
}
