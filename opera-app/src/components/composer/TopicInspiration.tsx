interface TopicInspirationProps {
  onPick: (topic: string) => void;
  disabled?: boolean;
}

const INSPIRATION_GROUPS = [
  {
    title: '好物推荐',
    examples: [
      '分享 5 个提升办公效率的小工具，适合刚开始做自媒体的人',
      '把一款通勤包从外观、容量、耐用度三个角度讲清楚',
    ],
  },
  {
    title: '知识拆解',
    examples: [
      '用 3 个生活场景解释什么是情绪价值，并给出可执行建议',
      '整理新手做小红书账号时最容易踩的 4 个误区',
    ],
  },
  {
    title: '经验复盘',
    examples: [
      '复盘一次失败的项目沟通，提炼 3 条可以马上用的经验',
      '从月入 5k 到稳定副业收入，我做对了哪些关键动作',
    ],
  },
  {
    title: '教程指南',
    examples: [
      '教新手用 Notion 搭一个内容选题库，包含字段和维护方法',
      '写一份周末整理衣柜的步骤清单，适合小户型租房人群',
    ],
  },
];

export default function TopicInspiration({ onPick, disabled = false }: TopicInspirationProps) {
  return (
    <section className="rounded-2xl border border-accent-100 bg-accent-50/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">选题灵感</h2>
          <p className="mt-0.5 text-xs text-neutral-500">点击示例可直接填入选题输入框。</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-accent-600">
          {INSPIRATION_GROUPS.length} 组
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {INSPIRATION_GROUPS.map((group) => (
          <div key={group.title} className="rounded-xl border border-white bg-white/80 p-3">
            <h3 className="text-xs font-semibold text-accent-700">{group.title}</h3>
            <div className="mt-2 space-y-2">
              {group.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(example)}
                  className="block w-full rounded-lg border border-neutral-100 bg-white px-3 py-2 text-left text-xs leading-5 text-neutral-600 transition-colors hover:border-accent-200 hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
