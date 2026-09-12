import CopyButton from './CopyButton';
import BodyEditor from './shared/BodyEditor';
import type { EditableBlockTone } from './EditableBlock';
import { countChars } from '../constants';

interface CaptionProps {
  text: string;
  contextKey?: string;
  onChange?: (next: string) => void;
  onBeforeChange?: () => boolean | void;
  onCustomEdit?: (prompt: string, original: string, signal?: AbortSignal) => Promise<string> | string;
  tone?: EditableBlockTone;
  disabled?: boolean;
}
export default function Caption({ text, contextKey, onChange, onBeforeChange, onCustomEdit, tone = 'primary', disabled }: CaptionProps) {
  return <section className="animate-slide-up">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><span className="h-4 w-1 rounded-full bg-primary-600" />
        <h3 className="text-sm font-semibold text-neutral-800">发布正文</h3>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{countChars(text)} 字</span>
      </div><CopyButton text={text} label="复制正文" />
    </div>
    {onChange ? <BodyEditor value={text} contextKey={contextKey} onChange={onChange} onBeforeChange={onBeforeChange}
      onRewrite={onCustomEdit} tone={tone} disabled={disabled} />
      : <p className="whitespace-pre-wrap text-sm leading-8 text-neutral-700">{text}</p>}
  </section>;
}
