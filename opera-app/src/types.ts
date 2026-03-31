// ============================================
// Opera 类型定义
// ============================================

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

/** 生成结果 */
export interface GenerationResult {
  coverTitles: string[];
  cards: string[];
  caption: string;
  tagGroups: TagGroup[];
}

/** 生成步骤 */
export type GenerationStep =
  | 'extracting'
  | 'titles'
  | 'cards'
  | 'caption'
  | 'tags'
  | 'done';

/** 步骤配置 */
export interface StepConfig {
  id: GenerationStep;
  label: string;
  description: string;
}

/** 应用状态 */
export type AppState = 'idle' | 'ready' | 'generating' | 'complete';
