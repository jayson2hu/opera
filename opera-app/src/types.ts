// ============================================
// Opera 类型定义
// ============================================

/** 顶部 Tab */
export type AppTab = 'adapter' | 'composer' | 'wechat';

/** 调性类型 */
export type ToneType = 'knowledge' | 'casual' | 'bff';

/** 调性配置 */
export interface ToneOption {
  id: ToneType;
  label: string;
  subtitle: string;
  description: string;
  emoji: string;
  example: string;
}

/** 标签分组类型 */
export type TagGroupType = 'broad' | 'precise' | 'longtail';

/** 标签分组 */
export interface TagGroup {
  type: TagGroupType;
  label: string;
  tags: string[];
}

/** 模型提供商 */
export type ProviderId = 'anthropic' | 'deepseek' | 'custom';

/** 提供商信息 */
export interface ProviderInfo {
  id: ProviderId;
  name: string;
  models: string[];
}

/** 提供商接口响应 */
export interface ProvidersResponse {
  default: ProviderId;
  available: ProviderInfo[];
}

/** 共享 Provider 选择 props */
export interface ProviderSelectionProps {
  providers: ProviderInfo[];
  selectedProvider: ProviderId | null;
  selectedModel: string;
  onProviderChange: (providerId: ProviderId | null) => void;
  onModelChange: (model: string) => void;
  loading?: boolean;
  error?: string | null;
}

/** 适配器生成结果 */
export interface GenerationResult {
  coverTitles: string[];
  cards: string[];
  caption: string;
  tagGroups: TagGroup[];
}

/** 适配器生成步骤 */
export type GenerationStep = 'extracting' | 'titles' | 'cards' | 'caption' | 'tags' | 'done';

/** 创作内容类型 */
export type ContentType = 'recommend' | 'knowledge' | 'story' | 'tutorial';

/** 创作目标字数 */
export type TargetLength = 'short' | 'medium' | 'long';

/** 创作重新生成目标 */
export type ComposerRegenerateTarget = 'title' | 'body' | 'tags';

/** 创作步骤 */
export type ComposerStep = 'extracting' | 'title' | 'body' | 'tags' | 'done';

/** 创作结果 */
export interface ComposerResult {
  title: string;
  body: string;
  tags: string[];
  imageKeywords: string[];
}

/** 创作请求 */
export interface ComposerRequest {
  topic: string;
  contentType: ContentType;
  tone: ToneType;
  targetLength: TargetLength;
  provider?: ProviderId;
  model?: string;
  regenerate?: ComposerRegenerateTarget;
}

/** 公众号文章类型 */
export type WeChatArticleType = 'insight' | 'guide' | 'story' | 'briefing';

/** 公众号生成步骤 */
export type WeChatStep = 'extracting' | 'title' | 'digest' | 'body' | 'done';

/** 公众号重生成目标 */
export type WeChatRegenerateTarget = 'title' | 'digest' | 'body';

/** 公众号生成结果 */
export interface WeChatComposeResult {
  title: string;
  digest: string;
  body: string;
}

/** 公众号生成请求 */
export interface WeChatComposeRequest {
  topic: string;
  articleType: WeChatArticleType;
  tone: ToneType;
  targetLength: TargetLength;
  provider?: ProviderId;
  model?: string;
  regenerate?: WeChatRegenerateTarget;
}

/** 草稿状态 */
export type WeChatDraftStatus = 'not_saved' | 'queued';

/** 公众号草稿 */
export interface WeChatDraftItem {
  id: string;
  topic: string;
  title: string;
  digest: string;
  body: string;
  articleType: WeChatArticleType;
  tone: ToneType;
  targetLength: TargetLength;
  status: WeChatDraftStatus;
  savedAt: string;
}

/** 通用步骤配置 */
export interface StepConfig {
  id: string;
  label: string;
  description: string;
}

/** 内容类型配置 */
export interface ContentTypeOption {
  id: ContentType;
  emoji: string;
  label: string;
  description: string;
}

/** 字数目标配置 */
export interface LengthOption {
  id: TargetLength;
  label: string;
  description: string;
}

/** 公众号文章类型配置 */
export interface WeChatArticleTypeOption {
  id: WeChatArticleType;
  emoji: string;
  label: string;
  description: string;
}
