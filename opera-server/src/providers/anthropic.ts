// ============================================
// Opera Server - Anthropic Claude Provider
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from './types.js';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, baseURL: string, model: string) {
    this.client = new Anthropic({ apiKey, baseURL, timeout: 120_000 });
    this.model = model;
  }

  async call(system: string, user: string, signal?: AbortSignal): Promise<string> {
    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      },
      { signal },
    );

    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }
    return block.text;
  }
}
