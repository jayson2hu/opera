// ============================================
// Opera Server - OpenAI-Compatible Provider
// (DeepSeek, custom proxy / relay sites, etc.)
// Uses axios to avoid Node.js native fetch crash on Windows.
// ============================================

import axios from 'axios';
import type { LLMProvider } from './types.js';

interface ChatCompletionResponse {
  choices: Array<{
    message: { content: string | null };
  }>;
}

export class OpenAICompatProvider implements LLMProvider {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(apiKey: string, baseURL: string, model: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.model = model;
  }

  async call(system: string, user: string, signal?: AbortSignal): Promise<string> {
    const url = this.baseURL.endsWith('/v1')
      ? `${this.baseURL}/chat/completions`
      : `${this.baseURL}/v1/chat/completions`;

    const response = await axios.post<ChatCompletionResponse>(
      url,
      {
        model: this.model,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 120_000,
        signal,
      },
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI-compatible API');
    }
    return content;
  }
}
