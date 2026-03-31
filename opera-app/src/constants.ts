import type { ToneOption, StepConfig, GenerationResult, TagGroup } from './types';

// ============================================
// 调性预设配置
// ============================================

export const TONE_OPTIONS: ToneOption[] = [
  {
    id: 'knowledge',
    label: '干货分享体',
    subtitle: 'Knowledge Sharing',
    description: '条理清晰、编号列表、适合收藏型内容',
    emoji: '📚',
    example: '3个方法帮你搞定XXX，建议收藏！',
  },
  {
    id: 'casual',
    label: '轻松科普体',
    subtitle: 'Casual Explainer',
    description: '通俗类比、对话感、降低阅读门槛',
    emoji: '💡',
    example: '你有没有想过，为什么XXX其实很简单？',
  },
  {
    id: 'bff',
    label: '闺蜜种草体',
    subtitle: 'BFF Recommendation',
    description: '感叹号多、emoji密集、情绪感染力强',
    emoji: '🔥',
    example: '姐妹们！！这个真的绝了！！不允许你们不知道！',
  },
];

// ============================================
// 生成步骤配置
// ============================================

export const GENERATION_STEPS: StepConfig[] = [
  { id: 'extracting', label: '提取观点', description: '正在提取核心观点...' },
  { id: 'titles', label: '封面标题', description: '正在生成封面标题...' },
  { id: 'cards', label: '卡片文字', description: '正在生成卡片文字...' },
  { id: 'caption', label: '正文文案', description: '正在生成正文文案...' },
  { id: 'tags', label: '推荐标签', description: '正在推荐标签...' },
  { id: 'done', label: '完成', description: '生成完成！' },
];

// ============================================
// 模拟数据 - 用于演示 streaming 效果
// ============================================

export const MOCK_RESULT: GenerationResult = {
  coverTitles: [
    '90%的人都不知道的高效阅读法，学会这3招就够了',
    '为什么你读了100本书却记不住？问题出在这里',
    '资深读书人的秘密：如何把一本书变成终身武器',
    '别再无效阅读了！这套方法让你的阅读效率翻3倍',
  ],
  cards: [
    '你有没有这种感觉？书看了不少，合上书就忘了大半。其实不是记忆力不好，而是阅读方法有问题。今天分享一套经过验证的高效阅读框架。',
    '第一招：带着问题读。翻开书之前，先写下3个你最想解决的问题。这样你的大脑就会自动过滤无用信息，锁定关键内容。',
    '第二招：用自己的话复述。每读完一个章节，合上书用30秒复述核心观点。说不出来的地方，就是你还没真正理解的地方。',
    '第三招：建立知识连接。把新学到的概念和你已有的知识做关联。比如这个观点让你想到了什么？可以用在什么场景？连接越多，记忆越牢。',
    '实践建议：不要贪多，一周精读一本比泛读五本更有效。读完后写一段200字的读书笔记，三个月后你会感谢现在的自己。',
  ],
  caption: '分享一个让我阅读效率提升3倍的方法论。\n\n以前我也是"读了就忘"星人，直到学会了这套框架：带着问题读 → 用自己的话复述 → 建立知识连接。\n\n核心原理其实很简单——主动阅读比被动阅读的记忆留存率高出5倍以上。\n\n最关键的一点：不要追求读书的数量，一周精读一本、写一段读书笔记，比泛泛翻完十本书有用得多。\n\n如果你也有"读了记不住"的困扰，试试这个方法，三个月后来找我反馈。',
  tagGroups: [
    {
      type: 'broad',
      label: '泛流量标签',
      tags: ['自我提升', '学习方法', '个人成长', '知识管理'],
    },
    {
      type: 'precise',
      label: '精准标签',
      tags: ['高效阅读', '读书方法', '阅读技巧', '读书笔记'],
    },
    {
      type: 'longtail',
      label: '长尾标签',
      tags: ['读了就忘怎么办', '主动阅读法', '阅读效率提升', '费曼学习法'],
    },
  ] as TagGroup[],
};

// ============================================
// 工具函数
// ============================================

/** 统计字数（中文按字符计数） */
export function countChars(text: string): number {
  return text.replace(/\s/g, '').length;
}

/** 统计段落数 */
export function countParagraphs(text: string): number {
  return text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0).length;
}
