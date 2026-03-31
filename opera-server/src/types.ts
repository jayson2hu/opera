import type { ProviderId } from './providers/types.js';

/** Tone type matching frontend ToneType */
export type ToneType = 'knowledge' | 'casual' | 'bff';

/** Tag group type */
export type TagGroupType = 'broad' | 'precise' | 'longtail';

/** Tag group structure */
export interface TagGroup {
  type: TagGroupType;
  label: string;
  tags: string[];
}

/** Full generation result */
export interface GenerationResult {
  coverTitles: string[];
  cards: string[];
  caption: string;
  tagGroups: TagGroup[];
}

/** Generation step identifiers */
export type GenerationStep =
  | 'extracting'
  | 'titles'
  | 'cards'
  | 'caption'
  | 'tags'
  | 'done';

/** Inbound request body for /api/generate */
export interface GenerateRequest {
  text: string;
  tone: ToneType;
  provider?: ProviderId;
  model?: string;
}
