// ============================================
// Opera Server - LLM Provider Interface
// ============================================

/** Unified interface for all LLM providers */
export interface LLMProvider {
  /** Call the LLM with system + user prompt, return the text response */
  call(system: string, user: string, signal?: AbortSignal): Promise<string>;
}

/** Supported provider identifiers */
export type ProviderId = 'anthropic' | 'deepseek' | 'custom';

/** Provider metadata for the /api/providers endpoint */
export interface ProviderInfo {
  id: ProviderId;
  name: string;
  models: string[];
}
