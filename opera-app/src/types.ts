export type AppTab = 'adapter' | 'composer' | 'wechat';

export type ToneType = 'knowledge' | 'casual' | 'bff';

export interface ToneOption {
  id: ToneType;
  label: string;
  subtitle: string;
  description: string;
  emoji: string;
  example: string;
}

export type TagGroupType = 'broad' | 'precise' | 'longtail';

export interface TagGroup {
  type: TagGroupType;
  label: string;
  tags: string[];
}

export type ProviderId = 'anthropic' | 'deepseek' | 'custom';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  models: string[];
}

export interface ProvidersResponse {
  default: ProviderId;
  available: ProviderInfo[];
}

export interface ProviderSelectionProps {
  providers: ProviderInfo[];
  selectedProvider: ProviderId | null;
  selectedModel: string;
  onProviderChange: (providerId: ProviderId | null) => void;
  onModelChange: (model: string) => void;
  loading?: boolean;
  error?: string | null;
}

export interface GenerationResult {
  coverTitles: string[];
  cards: string[];
  caption: string;
  tagGroups: TagGroup[];
}

export type GenerationStep = 'extracting' | 'titles' | 'cards' | 'caption' | 'tags' | 'done';

export type ContentType = 'recommend' | 'knowledge' | 'story' | 'tutorial';
export type TargetLength = 'short' | 'medium' | 'long';
export type ComposerRegenerateTarget = 'title' | 'body' | 'tags';
export type ComposerStep = 'extracting' | 'title' | 'body' | 'tags' | 'done';

export interface ComposerResult {
  title: string;
  body: string;
  tags: string[];
  imageKeywords: string[];
}

export interface ComposerRequest {
  topic: string;
  contentType: ContentType;
  tone: ToneType;
  targetLength: TargetLength;
  provider?: ProviderId;
  model?: string;
  regenerate?: ComposerRegenerateTarget;
}

export type WeChatArticleType = 'insight' | 'guide' | 'story' | 'briefing';
export type WeChatStep = 'extracting' | 'title' | 'digest' | 'body' | 'done';
export type WeChatRegenerateTarget = 'title' | 'digest' | 'body';

export interface WeChatComposeResult {
  title: string;
  digest: string;
  body: string;
}

export interface WeChatComposeRequest {
  topic: string;
  articleType: WeChatArticleType;
  tone: ToneType;
  targetLength: TargetLength;
  provider?: ProviderId;
  model?: string;
  regenerate?: WeChatRegenerateTarget;
}

export type WeChatDraftStatus = 'not_saved' | 'queued';

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

export interface StepConfig {
  id: string;
  label: string;
  description: string;
}

export interface ContentTypeOption {
  id: ContentType;
  emoji: string;
  label: string;
  description: string;
}

export interface LengthOption {
  id: TargetLength;
  label: string;
  description: string;
}

export interface WeChatArticleTypeOption {
  id: WeChatArticleType;
  emoji: string;
  label: string;
  description: string;
}
