import { useState } from 'react';

interface TopicInspirationProps {
  onPick: (topic: string) => void;
  disabled?: boolean;
}

interface InspirationGroup {
  id: string;
  emoji: string;
  title: string;
  examples: string[];
}

const INSPIRATION_GROUPS: InspirationGroup[] = [
  {
    id: 'recommend',
    emoji: '⭐',
    title: '好物推荐',
    examples: [
      '分享 5 个提升办公效率的小工具，适合刚开始做自媒体的人',
      '把一款通勤包从外观、容量、耐用度三个角度讲清楚',
    ],
  },
  {
    id: 'knowledge',
    emoji: '📚',
    title: '知识拆解',
    examples: [
      '用 3 个生活场景解释什么是情绪价值，并给出可执行建议',
      '整理新手做小红书账号时最容易踩的 4 个误区',
    ],
  },
  {
    id: 'story',
    emoji: '📖',
    title: '经验复盘',
    examples: [
      '复盘一次失败的项目沟通，提炼 3 条可以马上用的经验',
      '从月入 5k 到稳定副业收入，我做对了哪些关键动作',
    ],
  },
  {
    id: 'tutorial',
    emoji: '🧭',
    title: '教程指南',
    examples: [
      '教新手用 Notion 搭一个内容选题库，包含字段和维护方法',
      '写一份周末整理衣柜的步骤清单，适合小户型租房人群',
    ],
  },
];

/**
 * 选题灵感：4 组分类用芯片切换 + 当前组的 2 个示例整行展示。
 * 点示例直接填入主选题输入框。
 */
export default function TopicInspiration({ onPick, disabled = false }: TopicInspirationProps) {
  const [activeId, setActiveId] = useState<string>(INSPIRATION_GROUPS[0].id);
  const active = INSPIRATION_GROUPS.find((g) => g.id === activeId) ?? INSPIRATION_GROUPS[0];

  return (
    <section className="rounded-2xl border border-accent-100 bg-accent-50/40 p-3">
      <header className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-sm">💡</span>
          <h3 className="text-xs font-semibold text-neutral-700">选题灵感</h3>
        </div>
        <span className="text-[10px] text-neutral-400">点击示例直接填入</span>
      </header>

      {/* 分组芯片排 */}
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {INSPIRATION_GROUPS.map((group) => {
          const isActive = group.id === activeId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveId(group.id)}
              disabled={disabled}
              aria-pressed={isActive}
              className={`
                inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-all cursor-pointer
                ${isActive
                  ? 'bg-accent-500 text-white border-accent-500 shadow-card'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700'}
                disabled:opacity-60 disabled:cursor-not-allowed
              `}
            >
              <span aria-hidden="true">{group.emoji}</span>
              <span>{group.title}</span>
            </button>
          );
        })}
      </div>

      {/* 当前组的示例（整行展示） */}
      <div className="space-y-1.5">
        {active.examples.map((example) => (
          <button
            key={example}
            type="button"
            disabled={disabled}
            onClick={() => onPick(example)}
            className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-[12px] leading-5 text-neutral-700 transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
