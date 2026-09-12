import { useEffect, useId, useRef, useState } from 'react';
import type { ElementType, ReactNode } from 'react';

export type EditableBlockTone = 'primary' | 'accent' | 'emerald';
export interface EditableAlternate { label: string; text: string }
interface Props {
  as?: ElementType;
  text: string;
  contextKey?: string;
  alternates?: EditableAlternate[];
  tone?: EditableBlockTone;
  onCustomEdit?: (prompt: string, original: string, signal?: AbortSignal) => Promise<string> | string;
  onChange?: (next: string) => void;
  onBeforeChange?: () => boolean | void;
  className?: string;
  children?: ReactNode;
}
interface Edit { source: string; context: string; text: string }
const BUTTON_TONE = {
  primary: 'bg-primary-600 hover:bg-primary-700',
  accent: 'bg-accent-600 hover:bg-accent-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
};
/** Manual text never needs a provider; model responses are candidates, not writes. */
export default function EditableBlock({
  as: As = 'p', text, contextKey = text, alternates = [], tone = 'primary',
  onCustomEdit, onChange, onBeforeChange, className, children,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [manual, setManual] = useState<Edit | null>(null);
  const [candidate, setCandidate] = useState<Edit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const id = useId();
  useEffect(() => () => { request.current?.abort(); }, []);
  const stale = (edit: Edit) => edit.source !== text || edit.context !== contextKey;
  const apply = (edit: Edit, requireSavedVersion = false) => {
    if (stale(edit)) { setError('原稿已改变，请放弃旧候选并基于最新内容重试。'); return; }
    const saved = onBeforeChange?.();
    if (requireSavedVersion && saved === false) {
      setError('原稿版本尚未保存，候选未应用。请先导出稿件备份，恢复保存后再重试。');
      return;
    }
    onChange?.(edit.text);
    setManual(null); setCandidate(null); setError(null); setPanelOpen(false);
  };
  const generate = async (instruction = prompt) => {
    if (!instruction.trim() || !onCustomEdit || loading) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const base = { source: text, context: contextKey };
    setLoading(true); setError(null); setCandidate(null); setPanelOpen(true);
    try {
      const next = await onCustomEdit(instruction.trim(), text, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      if (!next.trim()) throw new Error('改写返回空内容，请重试。');
      setCandidate({ ...base, text: next });
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '改写失败，原文未改变。');
    } finally {
      if (!controller.signal.aborted && request.current === controller) setLoading(false);
    }
  };
  return (
    <div className={'group relative ' + (className ?? '')}>
      <div className="mb-1 flex flex-wrap justify-end gap-1 text-[11px]">
        {onChange && <button type="button" onClick={() => { setManual({ source: text, context: contextKey, text }); setError(null); }}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-600 hover:bg-neutral-50">编辑原文</button>}
        {onCustomEdit && <button type="button" onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen} className={'rounded-md px-2 py-1 text-white ' + BUTTON_TONE[tone]}>AI 改写候选</button>}
      </div>
      {manual ? <div className="rounded-xl border border-neutral-200 bg-white p-3">
        <label htmlFor={id + '-manual'} className="mb-2 block text-xs text-neutral-500">直接编辑原文 · 不调用模型</label>
        <textarea id={id + '-manual'} value={manual.text} onChange={(event) => setManual({ ...manual, text: event.target.value })}
          rows={Math.max(4, Math.min(12, manual.text.split('\n').length + 2))}
          className="w-full resize-y rounded-lg border border-neutral-200 p-2 text-sm leading-7 text-neutral-800" />
        {stale(manual) && <p role="alert" className="mt-2 text-xs text-red-600">其他内容已变更，请重新进入编辑以避免覆盖。</p>}
        <div className="mt-2 flex justify-end gap-2 text-xs">
          <button type="button" onClick={() => setManual(null)} className="rounded-lg border px-3 py-2">取消编辑</button>
          <button type="button" disabled={stale(manual)} onClick={() => apply(manual)} className={'rounded-lg px-3 py-2 text-white disabled:opacity-40 ' + BUTTON_TONE[tone]}>保存修改</button>
        </div>
      </div> : <As className="rounded-xl">{children ?? text}</As>}
      {panelOpen && <section className="mt-3 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3" aria-label="段落改写候选">
        <p className="text-xs text-neutral-500">仅生成候选；确认应用前，原文保持不变。</p>
        <label htmlFor={id + '-prompt'} className="block text-xs text-neutral-600">改写要求</label>
        <div className="flex gap-2">
          <input id={id + '-prompt'} value={prompt} maxLength={2000} onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：保留数字和事实，让表达更简洁" className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white p-2 text-xs"
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void generate(); } }} />
          <button type="button" disabled={loading || !prompt.trim() || !onCustomEdit} onClick={() => void generate()}
            className={'rounded-lg px-3 py-2 text-xs text-white disabled:opacity-40 ' + BUTTON_TONE[tone]}>{loading ? '生成中…' : '生成候选'}</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {onCustomEdit && ['更简洁，保留全部事实和数字', '更自然口语，但不编造信息'].map((instruction) =>
            <button key={instruction} type="button" disabled={loading} onClick={() => { setPrompt(instruction); void generate(instruction); }}
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-600 disabled:opacity-40">{instruction.startsWith('更简洁') ? '更简洁' : '更口语'} · AI</button>)}
          {alternates.map((alt) => <button type="button" key={alt.label}
            onClick={() => setCandidate({ source: text, context: contextKey, text: alt.text })}
            className="rounded-full border px-2 py-1 text-[11px]">{alt.label} · 查看候选</button>)}
        </div>
        {loading && <div role="status" className="flex items-center justify-between text-xs text-neutral-500"><span>正在生成；你仍可编辑原文。</span>
          <button type="button" onClick={() => { request.current?.abort(); setLoading(false); }} className="rounded-lg border px-2 py-1">取消请求</button></div>}
        {candidate && <div className="space-y-2">
          <details className="text-xs text-neutral-500"><summary className="cursor-pointer">对照请求时的原文</summary><p className="mt-2 whitespace-pre-wrap leading-6">{candidate.source}</p></details>
          <label htmlFor={id + '-candidate'} className="block text-xs font-medium text-neutral-600">AI 候选 · 可先调整再应用</label>
          <textarea id={id + '-candidate'} rows={5} value={candidate.text} onChange={(event) => setCandidate({ ...candidate, text: event.target.value })}
            className="w-full resize-y rounded-lg border border-neutral-200 bg-white p-2 text-sm leading-7 text-neutral-800" />
          {stale(candidate) && <p role="alert" className="text-xs text-red-600">原稿已改变，此候选已过期。请放弃后重新生成。</p>}
          <div className="flex justify-end gap-2 text-xs">
            <button type="button" onClick={() => setCandidate(null)} className="rounded-lg border px-3 py-2">放弃候选</button>
            <button type="button" disabled={stale(candidate) || !candidate.text.trim()} onClick={() => apply(candidate, true)}
              className={'rounded-lg px-3 py-2 text-white disabled:opacity-40 ' + BUTTON_TONE[tone]}>应用候选</button>
          </div>
        </div>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </section>}
    </div>
  );
}
