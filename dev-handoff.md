# Development Handoff: Opera

## Latest Status (2026-03-31)

Frontend-backend SSE integration complete. Full pipeline verified end-to-end with DeepSeek.

## Change Log

### 2026-03-31 (3): SSE Crash Fix + Frontend Integration

**Bug Fixed: SSE connection reset on Windows**

Root cause: `req.on('close')` in Express fires prematurely after `res.writeHead()` on Windows/Node.js. This aborted the `AbortController`, killing the in-flight LLM request. The process then crashed because Express couldn't cleanly close the already-broken response.

Fix (in `routes/generate.ts`):
- Changed `req.on('close')` → `res.on('close')` for client disconnect detection
- Added `clientGone` boolean flag alongside `AbortController` for clearer abort checks

**OpenAI SDK replaced with axios**

The `openai` npm package (v6.33.0) caused unexplained process crashes during SSE + async HTTP calls on Windows. Replaced `OpenAICompatProvider` with a direct `axios.post()` implementation. Functionally identical, no SDK dependency issues.

**Frontend SSE integration**

`App.tsx` rewritten: removed `MOCK_RESULT` + `setTimeout` simulation, replaced with real `fetch()` → `ReadableStream` reader that parses SSE events and updates component state progressively. Error events render inline.

**`npm run dev` changed**

Was: `tsx watch src/index.ts` (crashes on Windows during SSE)
Now: `tsc && node dist/index.js` (compile-then-run, stable)
Old behavior preserved as `npm run dev:watch` for non-SSE development.

### 2026-03-31 (2): Multi-Provider Support

Backend refactored from single Anthropic-only to multi-provider architecture. See provider abstraction layer in `src/providers/`. Added `GET /api/providers` endpoint. `POST /api/generate` accepts optional `provider` and `model` fields.

### 2026-03-31 (1): Initial Backend

Express + TypeScript backend with 5-step SSE pipeline. Prompt templates for XHS content generation.

## E2E Test Results (2026-03-31)

Tested with DeepSeek (`deepseek-chat`) via `test-e2e.mjs`:

| Test | Result |
|------|--------|
| `npx tsc --noEmit` | Zero errors |
| `npm run dev` (tsc + node) | Server starts, logs provider |
| `GET /api/health` | `{"status":"ok"}` |
| `GET /api/providers` | Returns configured providers |
| Empty body → 400 | Correct error |
| Invalid tone → 400 | Correct error |
| Invalid provider → 400 | Correct error |
| **Full SSE generation** | **10/10 events received** |
| SSE step: extracting | 3 core points extracted |
| SSE titles | 4 cover titles (number/contrast/pain/identity formulas) |
| SSE cards | 5 cards, each 50-80 chars |
| SSE caption | ~280 char caption with interaction prompt |
| SSE tags | 3 tiers: 3 broad + 4 precise + 3 longtail |
| SSE step: done | Stream closed cleanly |
| Frontend renders SSE | Progressive rendering works |

## Known Issues

1. **`tsx` crashes on Windows during SSE.** Must use `npm run dev` (compile-then-run). Do not use `tsx watch` or `tsx src/index.ts` directly for SSE-serving code.
2. **No error retry.** Mid-stream LLM failure = partial result + error. No automatic retry.
3. **No usage tracking or rate limiting.** API costs unbounded in V1.
4. **Input text not sanitized.** WeChat paste may include HTML/ads.
5. **Custom proxy providers untested.** Only DeepSeek verified. Anthropic and custom proxy need testing with real keys.

## Next Steps

1. **Frontend model selector UI** — dropdown calling `GET /api/providers`
2. **Prompt tuning per provider** — test with real articles across verticals
3. **Input preprocessing** — strip WeChat article artifacts
