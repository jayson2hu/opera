import type { FlowKind } from '../types';
import {
  useCreationDaysThisMonth,
  useCreationStreak,
  useRecentDrafts,
} from '../hooks/useRecentDrafts';

interface HomeProps {
  onPick: (kind: FlowKind) => void;
  onRestore: (kind: FlowKind, payload: unknown, id?: string) => void;
}

interface FlowCard {
  kind: FlowKind;
  emoji: string;
  tag: string;
  title: string;
  description: string;
  decorClass: string;
  iconClass: string;
  tagClass: string;
  actionClass: string;
  hoverClass: string;
}

const FLOW_CARDS: FlowCard[] = [
  {
    kind: 'wechat',
    emoji: '✍️',
    tag: '长文',
    title: '写公众号',
    description: '选题 → 结构化长文 → 段落级精修',
    decorClass: 'bg-emerald-100/70',
    iconClass: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600',
    tagClass: 'bg-emerald-50 text-emerald-600',
    actionClass: 'text-emerald-600',
    hoverClass: 'hover:border-emerald-200 hover:shadow-glow-emerald',
  },
  {
    kind: 'adapter',
    emoji: '⇋',
    tag: '改写',
    title: '改写成小红书',
    description: '粘贴长文 → 确认要点 → 笔记包',
    decorClass: 'bg-primary-100/70',
    iconClass: 'bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600',
    tagClass: 'bg-primary-50 text-primary-600',
    actionClass: 'text-primary-600',
    hoverClass: 'hover:border-primary-200 hover:shadow-glow-primary',
  },
  {
    kind: 'composer',
    emoji: '📒',
    tag: '原创',
    title: '写小红书',
    description: '三栏编排台，实时手机预览',
    decorClass: 'bg-accent-100/70',
    iconClass: 'bg-gradient-to-br from-accent-50 to-accent-100 text-accent-600',
    tagClass: 'bg-accent-50 text-accent-600',
    actionClass: 'text-accent-600',
    hoverClass: 'hover:border-accent-200 hover:shadow-glow-accent',
  },
];

const DRAFT_TONE: Record<FlowKind, { chip: string; bar: string }> = {
  wechat: { chip: 'bg-emerald-50 text-emerald-600', bar: 'from-emerald-400 to-emerald-500' },
  adapter: { chip: 'bg-primary-50 text-primary-600', bar: 'from-primary-400 to-primary-500' },
  composer: { chip: 'bg-accent-50 text-accent-600', bar: 'from-accent-400 to-accent-500' },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 13) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function openDraftDrawer() {
  window.dispatchEvent(new CustomEvent('opera:open-drafts'));
}

export default function Home({ onPick, onRestore }: HomeProps) {
  const greeting = getGreeting();
  const recentDrafts = useRecentDrafts(50);
  const creationStreak = useCreationStreak();
  const monthlyCreationDays = useCreationDaysThisMonth();

  return (
    <main className="relative flex-1 w-full max-w-6xl mx-auto overflow-hidden px-4 sm:px-6 pt-10 pb-16">
      <span aria-hidden="true" className="hero-glow -top-40 -left-40 h-[500px] w-[500px] bg-primary-200/50" />
      <span aria-hidden="true" className="hero-glow top-20 right-0 h-[400px] w-[400px] bg-accent-200/40" />

      <div className="relative">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-3 py-1.5 text-xs font-medium text-primary-700 shadow-card backdrop-blur">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary-500" />
          <span className="min-w-0">
            {greeting}，开始今天的创作
            <span className="mx-1.5 text-primary-300">·</span>
            {creationStreak > 0
              ? <>已连续创作 <b className="text-primary-600">{creationStreak} 天</b></>
              : <>本地工作台 · {recentDrafts.length} 个草稿</>}
          </span>
        </div>
        <h1 className="mt-5 text-[30px] leading-[1.15] font-black tracking-normal text-neutral-900 sm:text-[40px]">
          把灵感变成<br />
          <span className="animate-gradient-x bg-gradient-to-r from-primary-500 via-primary-600 to-accent-500 bg-[length:200%_auto] bg-clip-text text-transparent">
            可发布的内容
          </span>
        </h1>
        <p className="mt-3 max-w-md text-sm text-neutral-500">选择一个创作流程开始，所有草稿保存在本地，无需登录。</p>
      </div>

      <section aria-label="创作流程" className="relative mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5">
        {FLOW_CARDS.map((card) => (
          <button
            key={card.kind}
            type="button"
            onClick={() => onPick(card.kind)}
            className={`group relative overflow-hidden rounded-3xl border border-neutral-100 bg-white p-6 text-left shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card-hover ${card.hoverClass} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500`}
          >
            <span aria-hidden="true" className={`absolute -top-10 -right-10 h-32 w-32 rounded-full ${card.decorClass}`} />
            <span className="relative flex items-start justify-between">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-card ${card.iconClass}`}>
                <span aria-hidden="true">{card.emoji}</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.tagClass}`}>{card.tag}</span>
            </span>
            <span className="relative mt-4 block text-lg font-bold text-neutral-900">{card.title}</span>
            <span className="relative mt-1.5 block text-[13px] leading-relaxed text-neutral-500">{card.description}</span>
            <span className="relative mt-5 flex items-center justify-between gap-3">
              <span className="text-[11px] text-neutral-400">
                本月创作 <b className="text-neutral-700">{monthlyCreationDays[card.kind]}</b> 天
              </span>
              <span className={`flex shrink-0 -translate-x-1 items-center gap-1 text-xs font-semibold opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 ${card.actionClass}`}>
                开始 <span aria-hidden="true">→</span>
              </span>
            </span>
          </button>
        ))}
      </section>

      {recentDrafts.length > 0 && (
        <section className="relative mt-12 rounded-3xl border border-neutral-200 bg-gradient-to-br from-neutral-50/80 to-neutral-100/70 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-100 text-primary-600" aria-hidden="true">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              继续上次
            </h2>
            <button
              type="button"
              onClick={openDraftDrawer}
              className="shrink-0 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              查看全部 {recentDrafts.length} 个草稿 <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {recentDrafts.map((draft) => {
              const tone = DRAFT_TONE[draft.kind];
              return (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => onRestore(draft.kind, draft.payload, draft.id)}
                  className="group w-[240px] shrink-0 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`}>{draft.flowLabel}</span>
                    <span className="text-[10px] text-neutral-400">{draft.relativeTime}</span>
                  </span>
                  <span className="mt-2.5 block truncate text-sm font-semibold text-neutral-800">{draft.title}</span>
                  <span className="mt-3 block h-1 overflow-hidden rounded-full bg-neutral-100">
                    <span className={`block h-full rounded-full bg-gradient-to-r ${tone.bar}`} style={{ width: `${draft.progress}%` }} />
                  </span>
                  <span className={`mt-1.5 block truncate text-[10px] ${draft.progress === 100 ? 'text-emerald-600' : 'text-neutral-400'}`}>
                    {draft.progress}% · {draft.statusLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
