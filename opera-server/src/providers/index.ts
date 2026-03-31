// ============================================
// Opera Server - Provider Factory
// ============================================

import { config } from '../config.js';
import type { LLMProvider, ProviderId, ProviderInfo } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatProvider } from './openai-compat.js';

/** Create an LLMProvider instance for the given provider and optional model override */
export function createProvider(
  providerId?: ProviderId,
  modelOverride?: string,
): LLMProvider {
  const id = providerId ?? config.defaultProvider;

  switch (id) {
    case 'anthropic': {
      const { apiKey, baseURL, model } = config.anthropic;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
      return new AnthropicProvider(apiKey, baseURL, modelOverride ?? model);
    }
    case 'deepseek': {
      const { apiKey, baseURL, model } = config.deepseek;
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');
      return new OpenAICompatProvider(apiKey, baseURL, modelOverride ?? model);
    }
    case 'custom': {
      const { apiKey, baseURL, model } = config.custom;
      if (!apiKey) throw new Error('CUSTOM_API_KEY is not configured');
      return new OpenAICompatProvider(apiKey, baseURL, modelOverride ?? model);
    }
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

/** Return metadata for all providers that have an API key configured */
export function getAvailableProviders(): {
  default: ProviderId;
  available: ProviderInfo[];
} {
  const available: ProviderInfo[] = [];

  if (config.anthropic.apiKey) {
    available.push({
      id: 'anthropic',
      name: 'Claude',
      models: [config.anthropic.model],
    });
  }
  if (config.deepseek.apiKey) {
    available.push({
      id: 'deepseek',
      name: 'DeepSeek',
      models: [config.deepseek.model],
    });
  }
  if (config.custom.apiKey) {
    available.push({
      id: 'custom',
      name: '自定义',
      models: [config.custom.model],
    });
  }

  return { default: config.defaultProvider, available };
}
