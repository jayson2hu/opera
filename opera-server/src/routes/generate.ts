// ============================================
// Opera Server - /api/generate & /api/providers
// ============================================

import { Router, type Request, type Response } from 'express';
import { config } from '../config.js';
import type { GenerateRequest, ToneType } from '../types.js';
import type { ProviderId } from '../providers/types.js';
import { createProvider, getAvailableProviders } from '../providers/index.js';
import {
  buildExtractionPrompt,
  buildTitlesPrompt,
  buildCardsPrompt,
  buildCaptionPrompt,
  buildTagsPrompt,
} from '../prompts.js';

const router = Router();

// ── Helpers ─────────────────────────────────────────────────

/** Send an SSE event to the client */
function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Extract JSON from an LLM response (handles markdown fences) */
function extractJSON<T>(raw: string): T {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned) as T;
}

// ── Validation ──────────────────────────────────────────────

const VALID_TONES = new Set<ToneType>(['knowledge', 'casual', 'bff']);
const VALID_PROVIDERS = new Set<ProviderId>(['anthropic', 'deepseek', 'custom']);

function validateRequest(body: unknown): {
  valid: boolean;
  error?: string;
  data?: GenerateRequest;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const { text, tone, provider, model } = body as Record<string, unknown>;

  if (typeof text !== 'string' || text.trim().length === 0) {
    return { valid: false, error: 'text is required and must be non-empty' };
  }

  if (text.length > config.maxInputLength) {
    return {
      valid: false,
      error: `text exceeds maximum length of ${config.maxInputLength} characters`,
    };
  }

  if (!VALID_TONES.has(tone as ToneType)) {
    return {
      valid: false,
      error: `tone must be one of: ${[...VALID_TONES].join(', ')}`,
    };
  }

  if (provider !== undefined && !VALID_PROVIDERS.has(provider as ProviderId)) {
    return {
      valid: false,
      error: `provider must be one of: ${[...VALID_PROVIDERS].join(', ')}`,
    };
  }

  if (model !== undefined && typeof model !== 'string') {
    return { valid: false, error: 'model must be a string' };
  }

  return {
    valid: true,
    data: {
      text: text.trim(),
      tone: tone as ToneType,
      provider: provider as ProviderId | undefined,
      model: model as string | undefined,
    },
  };
}

// ── GET /api/providers ──────────────────────────────────────

router.get('/providers', (_req: Request, res: Response) => {
  res.json(getAvailableProviders());
});

// ── POST /api/generate (SSE) ────────────────────────────────

router.post('/generate', async (req: Request, res: Response) => {
  // 1. Validate request
  const validation = validateRequest(req.body);
  if (!validation.valid || !validation.data) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { text, tone, provider: providerId, model: modelOverride } = validation.data;

  // 2. Create the LLM provider
  let callLLM: (system: string, user: string, signal?: AbortSignal) => Promise<string>;
  try {
    const llm = createProvider(providerId, modelOverride);
    callLLM = (s, u, sig) => llm.call(s, u, sig);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create provider';
    res.status(400).json({ error: message });
    return;
  }

  // 3. Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 4. Handle client disconnect
  // Note: listen on res 'close' not req 'close' — req close fires too early
  // after writeHead in some Express/Node versions on Windows.
  const abortController = new AbortController();
  let clientGone = false;
  res.on('close', () => {
    clientGone = true;
    abortController.abort();
  });

  try {
    // ── Step 1: Extract core points ──────────────────────
    sendSSE(res, 'step', { step: 'extracting' });

    const extractionPrompt = buildExtractionPrompt(text, tone);
    const extractionRaw = await callLLM(
      extractionPrompt.system,
      extractionPrompt.user,
      abortController.signal,
    );
    const { points } = extractJSON<{ points: string[] }>(extractionRaw);

    if (clientGone) return;

    // ── Step 2: Generate cover titles ────────────────────
    sendSSE(res, 'step', { step: 'titles' });

    const titlesPrompt = buildTitlesPrompt(text, points, tone);
    const titlesRaw = await callLLM(
      titlesPrompt.system,
      titlesPrompt.user,
      abortController.signal,
    );
    const { coverTitles } = extractJSON<{ coverTitles: string[] }>(titlesRaw);

    if (clientGone) return;
    sendSSE(res, 'titles', { coverTitles });

    // ── Step 3: Generate slide cards ─────────────────────
    sendSSE(res, 'step', { step: 'cards' });

    const cardsPrompt = buildCardsPrompt(text, points, tone);
    const cardsRaw = await callLLM(
      cardsPrompt.system,
      cardsPrompt.user,
      abortController.signal,
    );
    const { cards } = extractJSON<{ cards: string[] }>(cardsRaw);

    if (clientGone) return;
    sendSSE(res, 'cards', { cards });

    // ── Step 4: Generate caption ─────────────────────────
    sendSSE(res, 'step', { step: 'caption' });

    const captionPrompt = buildCaptionPrompt(text, points, cards, tone);
    const captionRaw = await callLLM(
      captionPrompt.system,
      captionPrompt.user,
      abortController.signal,
    );
    const { caption } = extractJSON<{ caption: string }>(captionRaw);

    if (clientGone) return;
    sendSSE(res, 'caption', { caption });

    // ── Step 5: Generate hashtags ────────────────────────
    sendSSE(res, 'step', { step: 'tags' });

    const tagsPrompt = buildTagsPrompt(text, points, tone);
    const tagsRaw = await callLLM(
      tagsPrompt.system,
      tagsPrompt.user,
      abortController.signal,
    );
    const { tagGroups } = extractJSON<{
      tagGroups: { type: string; label: string; tags: string[] }[];
    }>(tagsRaw);

    if (clientGone) return;
    sendSSE(res, 'tags', { tagGroups });

    // ── Done ─────────────────────────────────────────────
    sendSSE(res, 'step', { step: 'done' });
    res.end();
  } catch (err: unknown) {
    if (clientGone) return;

    const message =
      err instanceof Error ? err.message : 'Unknown error during generation';
    console.error('[opera-server] Generation error:', message);

    if (!res.writableEnded) {
      sendSSE(res, 'error', { error: message });
      res.end();
    }
  }
});

export default router;
