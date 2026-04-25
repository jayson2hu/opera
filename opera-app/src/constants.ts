import type {
  ContentTypeOption,
  LengthOption,
  StepConfig,
  ToneOption,
  WeChatArticleTypeOption,
} from './types';

export const TONE_OPTIONS: ToneOption[] = [
  {
    id: 'knowledge',
    label: '知识分享',
    subtitle: 'Knowledge',
    description: '结构清晰、信息密度高，适合经验总结和方法论内容。',
    emoji: '📚',
    example: '这 3 个细节，决定一篇内容能不能被看完',
  },
  {
    id: 'casual',
    label: '轻松解释',
    subtitle: 'Casual',
    description: '语气自然、解释友好，适合把复杂观点讲得更好懂。',
    emoji: '💬',
    example: '换个简单说法，你可以把它理解成这样',
  },
  {
    id: 'bff',
    label: '朋友推荐',
    subtitle: 'BFF',
    description: '更有情绪和代入感，适合种草、推荐和生活化表达。',
    emoji: '✨',
    example: '这个方法真的建议你试一次，省心很多',
  },
];

export const GENERATION_STEPS: StepConfig[] = [
  { id: 'extracting', label: '提取要点', description: '正在拆解文章核心信息...' },
  { id: 'titles', label: '生成标题', description: '正在生成小红书封面标题...' },
  { id: 'cards', label: '生成卡片', description: '正在整理卡片文案...' },
  { id: 'caption', label: '生成正文', description: '正在生成发布正文...' },
  { id: 'tags', label: '生成标签', description: '正在匹配话题标签...' },
  { id: 'done', label: '完成', description: '内容生成完成' },
];

export const COMPOSER_STEPS: StepConfig[] = [
  { id: 'extracting', label: '分析选题', description: '正在分析选题角度和目标读者...' },
  { id: 'title', label: '生成标题', description: '正在生成帖子标题...' },
  { id: 'body', label: '撰写正文', description: '正在流式撰写正文...' },
  { id: 'tags', label: '生成标签', description: '正在生成标签和配图关键词...' },
  { id: 'done', label: '完成', description: '原创帖子生成完成' },
];

export const WECHAT_STEPS: StepConfig[] = [
  { id: 'extracting', label: '分析选题', description: '正在规划公众号文章结构...' },
  { id: 'title', label: '生成标题', description: '正在生成公众号标题...' },
  { id: 'digest', label: '生成摘要', description: '正在生成文章摘要...' },
  { id: 'body', label: '撰写正文', description: '正在流式撰写正文...' },
  { id: 'done', label: '完成', description: '公众号文章生成完成' },
];

export const CONTENT_TYPE_OPTIONS: ContentTypeOption[] = [
  { id: 'recommend', emoji: '⭐', label: '种草推荐', description: '产品、工具、服务或体验推荐' },
  { id: 'knowledge', emoji: '📚', label: '知识干货', description: '方法论、清单、经验总结' },
  { id: 'story', emoji: '📖', label: '故事经验', description: '个人经历、案例复盘、成长记录' },
  { id: 'tutorial', emoji: '🧭', label: '教程指南', description: '步骤拆解、操作流程、避坑指南' },
];

export const LENGTH_OPTIONS: LengthOption[] = [
  { id: 'short', label: '短文 ~200字', description: '适合快速发布和轻量表达' },
  { id: 'medium', label: '中等 ~400字', description: '信息完整，适合多数场景' },
  { id: 'long', label: '长文 600字+', description: '适合深度观点和完整论述' },
];

export const WECHAT_ARTICLE_TYPE_OPTIONS: WeChatArticleTypeOption[] = [
  { id: 'insight', emoji: '💡', label: '观点洞察', description: '表达判断、趋势、认知升级' },
  { id: 'guide', emoji: '🧭', label: '方法指南', description: '输出步骤、框架和可执行建议' },
  { id: 'story', emoji: '📖', label: '故事叙事', description: '用经历、案例或冲突展开文章' },
  { id: 'briefing', emoji: '📰', label: '简报解读', description: '对事件、信息和变化做梳理' },
];

export const WECHAT_DRAFT_STORAGE_KEY = 'opera.wechat.drafts';

const DEFAULT_DEV_API_BASE_URL = 'http://localhost:3001';
const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export const API_BASE_URL = ENV_API_BASE_URL || (import.meta.env.DEV ? DEFAULT_DEV_API_BASE_URL : '');

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function countChars(text: string): number {
  return text.replace(/\s/g, '').length;
}

export function countParagraphs(text: string): number {
  return text
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim().length > 0).length;
}
