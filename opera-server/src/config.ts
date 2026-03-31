// ============================================
// Opera Server - Configuration
// ============================================

import dotenv from 'dotenv';
import type { ProviderId } from './providers/types.js';

dotenv.config();

const VALID_PROVIDERS = new Set<ProviderId>(['anthropic', 'deepseek', 'custom']);

function parseProvider(value: string | undefined): ProviderId {
  const v = (value ?? 'anthropic').toLowerCase() as ProviderId;
  if (!VALID_PROVIDERS.has(v)) {
    console.warn(
      `[opera-server] Unknown AI_PROVIDER "${value}", falling back to "anthropic"`,
    );
    return 'anthropic';
  }
  return v;
}

export const config = {
  /** Server port */
  port: parseInt(process.env.PORT || '3001', 10),

  /** Default AI provider */
  defaultProvider: parseProvider(process.env.AI_PROVIDER),

  /** Maximum input text length (characters) */
  maxInputLength: 50_000,

  /** Anthropic configuration */
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  },

  /** DeepSeek configuration */
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },

  /** Custom OpenAI-compatible provider configuration */
  custom: {
    apiKey: process.env.CUSTOM_API_KEY || '',
    baseURL: process.env.CUSTOM_BASE_URL || '',
    model: process.env.CUSTOM_MODEL || '',
  },

  /** CORS allowed origins */
  corsOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ],
} as const;

/** Validate that the default provider has its API key configured */
export function validateConfig(): void {
  const provider = config.defaultProvider;

  const keyMap: Record<ProviderId, string> = {
    anthropic: config.anthropic.apiKey,
    deepseek: config.deepseek.apiKey,
    custom: config.custom.apiKey,
  };

  if (!keyMap[provider]) {
    console.error(
      `[opera-server] Default provider is "${provider}" but its API key is not set.\n` +
        'Copy .env.example to .env and configure the relevant key.',
    );
    process.exit(1);
  }

  if (provider === 'custom' && !config.custom.baseURL) {
    console.error(
      '[opera-server] CUSTOM_BASE_URL is required when AI_PROVIDER=custom.',
    );
    process.exit(1);
  }
}
