import { useState } from 'react';

const GUIDE_ITEMS = [
  {
    title: '先选封面标题',
    description: '优先挑最明确、最有点击理由的标题，必要时压缩到 20 字内。',
  },
  {
    title: '再做封面图',
    description: '用 Canva、稿定或小红书模板，把标题和关键词放在第一视觉层。',
  },
  {
    title: '检查正文节奏',
    description: '保留开头钩子，中段分点，结尾放行动建议或互动问题。',
  },
  {
    title: '复制标签发布',
    description: '选择 3-5 个相关标签，避免只堆热门词。',
  },
];

export default function UsageGuide() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-neutral-800">生成后怎么用</span>
          <span className="mt-0.5 block text-xs text-neutral-500">把改写结果整理成可发布的小红书笔记。</span>
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-primary-600">
          {open ? '收起' : '展开'}
        </span>
      </button>

      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GUIDE_ITEMS.map((item, index) => (
            <div key={item.title} className="rounded-xl border border-white bg-white/80 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-100 text-xs font-semibold text-primary-700">
                  {index + 1}
                </span>
                <h3 className="text-sm font-semibold text-neutral-800">{item.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
