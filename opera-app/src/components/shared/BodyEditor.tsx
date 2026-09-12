import { useId, useState } from 'react';
import { countChars } from '../../constants';
import EditableBlock from '../EditableBlock';

interface Props {
  value: string;
  contextKey?: string;
  onChange: (value: string) => void;
  onBeforeChange?: () => boolean | void;
  onRewrite?: (prompt: string, text: string, signal?: AbortSignal) => Promise<string> | string;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'accent' | 'emerald';
}
export default function BodyEditor({ value, contextKey = value, onChange, onBeforeChange, onRewrite, onRegenerate, canRegenerate, disabled, tone = 'primary' }: Props) {
  const [mode, setMode] = useState<'edit' | 'paragraphs'>('edit');
  const id = useId();
  // Keep exact delimiters: editing a paragraph must not reformat neighboring content.
  const parts = value.split(/(\n\s*\n)/);
  return <section className="space-y-3" aria-label="正文编辑器">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-neutral-600">正文 · {countChars(value)} 字</label>
      <div className="flex flex-wrap gap-1 text-xs">
        <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')} className="rounded-lg border border-neutral-200 px-2 py-1.5">全文编辑</button>
        <button type="button" aria-pressed={mode === 'paragraphs'} onClick={() => setMode('paragraphs')} className="rounded-lg border border-neutral-200 px-2 py-1.5">段落改写</button>
        {onRegenerate && <button type="button" onClick={onRegenerate} disabled={!canRegenerate || disabled}
          className="rounded-lg border border-neutral-200 px-2 py-1.5 disabled:opacity-40">生成正文候选</button>}
      </div>
    </div>
    {mode === 'edit' ? <textarea id={id} value={value} onFocus={onBeforeChange} disabled={disabled}
      onChange={(event) => onChange(event.target.value)} placeholder="直接修改正文；无需模型在线。自动保存会保留你的输入。"
      className="min-h-[360px] w-full resize-y rounded-xl border border-neutral-200 bg-white p-4 text-sm leading-8 text-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60" />
      : <div id={id} className="space-y-4">{parts.map((part, index) => index % 2 === 0 && part.trim()
        ? <EditableBlock key={index} text={part} contextKey={contextKey} tone={tone} onCustomEdit={disabled ? undefined : onRewrite}
          onBeforeChange={onBeforeChange} onChange={(next) => { const updated = [...parts]; updated[index] = next; onChange(updated.join('')); }}
          className="text-sm leading-8 text-neutral-800"><span className="block whitespace-pre-wrap">{part}</span></EditableBlock> : null)}
        {!value.trim() && <p className="text-xs text-neutral-500">切换到全文编辑开始写作。</p>}</div>}
    <p className="text-[11px] text-neutral-400">手工编辑不消耗模型；AI 结果确认后才写入。重要改动可使用上方版本记录恢复。</p>
  </section>;
}
