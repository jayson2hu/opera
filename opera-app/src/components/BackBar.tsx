import type { FlowKind } from '../types';

interface BackBarProps {
  kind: FlowKind;
  /** target=undefined 表示返回首页；传入 FlowKind 表示直接切换到另一个流程 */
  onBack: (target?: FlowKind) => void;
}

interface FlowMeta {
  label: string;
  emoji: string;
  dotClass: string;
  textClass: string;
}

const FLOW_META: Record<FlowKind, FlowMeta> = {
  wechat: {
    label: '写公众号',
    emoji: '✍️',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
  },
  adapter: {
    label: '改写成小红书',
    emoji: '⇋',
    dotClass: 'bg-primary-500',
    textClass: 'text-primary-700',
  },
  composer: {
    label: '写小红书',
    emoji: '📒',
    dotClass: 'bg-accent-500',
    textClass: 'text-accent-700',
  },
};

export default function BackBar({ kind, onBack }: BackBarProps) {
  const current = FLOW_META[kind];
  const others = (Object.keys(FLOW_META) as FlowKind[]).filter((k) => k !== kind);

  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onBack()}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 cursor-pointer"
            aria-label="返回首页"
          >
            <span aria-hidden="true">←</span>
            <span>返回</span>
          </button>
          <span aria-hidden="true" className="text-neutral-300">/</span>
          <span className={`inline-flex items-center gap-2 text-sm font-semibold ${current.textClass}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${current.dotClass}`} />
            <span aria-hidden="true">{current.emoji}</span>
            <span className="truncate">{current.label}</span>
          </span>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-xs text-neutral-400">切换到</span>
          {others.map((other) => {
            const meta = FLOW_META[other];
            return (
              <button
                key={other}
                type="button"
                onClick={() => onBack(other)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 cursor-pointer"
              >
                <span aria-hidden="true">{meta.emoji}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
