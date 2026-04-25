import type {
  ContentTypeOption,
  LengthOption,
  StepConfig,
  ToneOption,
  WeChatArticleTypeOption,
} from './types';

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
// 适配器 / 创作步骤配置
// ============================================

export const GENERATION_STEPS: StepConfig[] = [
  { id: 'extracting', label: '提取观点', description: '正在提取核心观点...' },
  { id: 'titles', label: '封面标题', description: '正在生成封面标题...' },
  { id: 'cards', label: '卡片文字', description: '正在生成卡片文字...' },
  { id: 'caption', label: '正文文案', description: '正在生成正文文案...' },
  { id: 'tags', label: '推荐标签', description: '正在推荐标签...' },
  { id: 'done', label: '完成', description: '生成完成！' },
];

export const COMPOSER_STEPS: StepConfig[] = [
  { id: 'extracting', label: '提炼主题', description: '正在理解主题并规划结构...' },
  { id: 'title', label: '生成标题', description: '正在生成标题...' },
  { id: 'body', label: '撰写正文', description: '正在流式生成正文...' },
  { id: 'tags', label: '标签配图', description: '正在生成标签和配图建议...' },
  { id: 'done', label: '完成', description: '创作完成！' },
];

export const WECHAT_STEPS: StepConfig[] = [
  { id: 'extracting', label: '定位选题', description: '正在梳理公众号文章定位...' },
  { id: 'title', label: '生成标题', description: '正在拟定适合公众号的标题...' },
  { id: 'digest', label: '撰写摘要', description: '正在提炼文章摘要...' },
  { id: 'body', label: '生成正文', description: '正在流式撰写公众号正文...' },
  { id: 'done', label: '完成', description: '公众号文章已生成完成！' },
];

// ============================================
// Composer / WeChat 配置
// ============================================

export const CONTENT_TYPE_OPTIONS: ContentTypeOption[] = [
  { id: 'recommend', emoji: '🌟', label: '种草推荐', description: '产品 / 体验安利' },
  { id: 'knowledge', emoji: '📚', label: '干货分享', description: '方法论 / 技巧' },
  { id: 'story', emoji: '🙋', label: '个人经历', description: '真实故事 / 成长' },
  { id: 'tutorial', emoji: '🔬', label: '知识科普', description: '概念解释 / 科普' },
];

export const LENGTH_OPTIONS: LengthOption[] = [
  { id: 'short', label: '短 ~200字', description: '适合快速表达重点' },
  { id: 'medium', label: '中 ~400字', description: '结构完整，信息密度均衡' },
  { id: 'long', label: '长 600字+', description: '适合展开经历与案例' },
];

export const WECHAT_ARTICLE_TYPE_OPTIONS: WeChatArticleTypeOption[] = [
  { id: 'insight', emoji: '🧭', label: '观点评论', description: '适合行业观察、方法洞察、趋势判断' },
  { id: 'guide', emoji: '🗂️', label: '方法指南', description: '适合步骤拆解、经验总结、教程类长文' },
  { id: 'story', emoji: '✍️', label: '经历复盘', description: '适合案例分享、成长故事、实战复盘' },
  { id: 'briefing', emoji: '📰', label: '精选简报', description: '适合资讯整合、观点摘录、专栏简报' },
];

export const WECHAT_DRAFT_STORAGE_KEY = 'opera.wechat.drafts';

// ============================================
// API 配置
// ============================================

const DEFAULT_DEV_API_BASE_URL = 'http://localhost:3001';
const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export const API_BASE_URL = ENV_API_BASE_URL || (import.meta.env.DEV ? DEFAULT_DEV_API_BASE_URL : '');

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

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
    .filter((paragraph) => paragraph.trim().length > 0).length;
}
