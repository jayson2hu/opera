# Product Handoff: WOA-to-XHS Content Converter

## Executive Summary
A specialized content adaptation tool that transforms long-form WeChat Official Account (WOA) articles into visual, high-engagement Xiaohongshu (XHS) posts.

## 1. Core Decision & Strategy
- **Positioning:** Content **Adaptation** (Translation), not Distribution (Publishing).
- **Core Problem:** "Format Friction"—the 45-60 minutes required to manually re-flavor a technical article for a visual, social-first platform.
- **Target User:** "The Overwhelmed Solo Creator"—experts/influencers with a strong WeChat presence but a "dead" or neglected Xiaohongshu account due to high production overhead.

## 2. MVP Scope (V1 Boundary)
To minimize technical risk and maximize time-to-value:

### In-Scope (Must-Have)
- **Manual Text Ingest:** Large text area for pasting the copied contents of a WeChat article.
- **AI "Points to Slides" Extractor:** LLM-driven logic to pull 4-6 high-impact "Golden Nuggets" for slide text, each strictly limited to 50-80 characters to fit XHS card layouts without breaking visual formatting.
- **Cover Title Generator:** Generate 3-5 alternative XHS-optimized cover titles per article using proven title formulas (number-based, contrast-based, pain-point-based, identity-based). Cover titles determine ~90% of click-through rate on XHS.
- **"XHS Vibe" Caption Generator:** Style-transfer with **tone selector** — user chooses from at least 3 presets before generation:
  - 干货分享体 (Knowledge sharing — structured, clear, "建议收藏")
  - 轻松科普体 (Casual explainer — approachable analogies, conversational)
  - 闺蜜种草体 (BFF recommendation — emotional, exclamation-heavy, emoji-dense)
  This addresses the core trust risk: knowledge-type creators fear AI output "doesn't sound like me."
- **Hashtag Engine:** Automatic generation of 8-12 niche-relevant XHS hashtags, displayed in 3 tiers: broad traffic tags (1-2), precise niche tags (3-4), long-tail tags (2-3).
- **Streaming Output:** Use streaming/progressive rendering during AI generation. Display step-by-step progress ("正在提取核心观点..." → "正在生成卡片文字..." → "正在推荐标签...") to prevent user abandonment during the 15-45 second processing window.
- **Copy-to-Clipboard:** Quick buttons to copy text cards for use in external tools (Canva/Meitu/XHS App).

### Out-of-Scope (Explicitly Removed for V1)
- **URL Scraping:** No automatic WeChat URL fetching (avoiding anti-scraping and JS rendering complexity).
- **Direct Publishing API:** No "Push to XHS" button (avoiding account bans and API gatekeeping).
- **Image Editor:** No built-in canvas/editing tool (leverage existing user habits with Canva/Meitu).
- **Account Management:** No login/auth required for the first test version.

## 3. Product Development Plan

### Phase 0: Validation (Week 1)
- **Manual Concierge Test:** Manually convert 3 articles for 3 creators using direct LLM prompts.
- **Success Metric:** At least one creator actually *posts* the content to their Xiaohongshu account.

### Phase 1: Prototype (Week 2-3) — IN PROGRESS

#### 1a. Frontend (DONE)
- **Location:** `opera-app/`
- **Tech Stack:** Vite + React + TypeScript + Tailwind CSS
- **Status:** Complete. 9 components implemented. Real SSE client integrated — calls `POST /api/generate` and renders results progressively. Responsive layout (mobile + desktop). Design spec in `opera-app/DESIGN.md`.
- **Run:** `cd opera-app && npm run dev` → http://localhost:5173

#### 1b. Backend (DONE)
- **Location:** `opera-server/`
- **Tech Stack:** Node.js + Express + TypeScript + Multi-provider LLM (Anthropic / DeepSeek / Custom)
- **Status:** Complete. Multi-provider architecture with unified LLM abstraction layer. SSE streaming endpoint orchestrates 5 sequential LLM calls. E2E tested with DeepSeek — all 10 SSE events verified.
- **Important:** Use `npm run dev` (compiles then runs `node dist/index.js`). Do NOT use `tsx` directly — it causes process crashes during SSE + async HTTP calls on Windows.
- **File Structure:**
  ```
  opera-server/src/
    index.ts                  # Express server entry (port 3001)
    config.ts                 # Multi-provider env config
    types.ts                  # Shared type definitions
    prompts.ts                # 5-step LLM prompt templates (core IP)
    providers/
      types.ts                # LLMProvider interface + ProviderId
      anthropic.ts            # Anthropic Claude provider
      openai-compat.ts        # OpenAI-compatible provider (axios-based)
      index.ts                # Provider factory + available providers query
    routes/generate.ts        # SSE streaming handler + /api/providers
  ```
- **Run:** `cd opera-server && cp .env.example .env && npm install && npm run dev` → http://localhost:3001
- **API Endpoints:**
  - `POST /api/generate` — body `{ "text": "...", "tone": "...", "provider?": "...", "model?": "..." }` → SSE stream
  - `GET /api/providers` — returns available providers and default config
  - `GET /api/health` — health check

#### 1c. Frontend-Backend Integration (DONE)
- Frontend `App.tsx` calls `POST /api/generate` via `fetch` and reads SSE stream using `ReadableStream` reader.
- Each SSE event (`titles`, `cards`, `caption`, `tags`) maps to component state for progressive rendering.
- Error events display inline error message in the UI.
- **Remaining:** Frontend model selector UI (provider/model dropdown) not yet built.

### Phase 2: Refinement (Week 4+)
- Add keyword-based image suggestions.
- Improve prompt engineering based on initial user feedback.
- Prompt tuning with real WeChat articles across different verticals (职场/教育/成长/生活方式).

## 4. Key Risks & Assumptions
1. **The Voice Assumption:** Can the LLM authentically mimic a specific creator's personality?
2. **The Visual Gap:** Is the *text* conversion the real bottleneck, or is it still the *image creation*?
3. **Distribution Barrier:** Without direct posting, will users still find the manual copy-paste workflow fast enough?
4. **API Cost:** Single conversion requires 5 Claude API calls. Estimated cost ~0.5-2 RMB per conversion. No pricing strategy defined yet.
5. **XHS AI Content Policy:** Xiaohongshu may reduce recommendation weight for AI-generated content. Product should position as "creation assist" not "content replacement."

## 5. Technical Architecture

```
┌─────────────────────┐     SSE Stream      ┌─────────────────────┐
│   opera-app (FE)    │ ◄──────────────────► │  opera-server (BE)  │
│   React + Vite      │  POST /api/generate  │  Express + TS       │
│   :5173             │  GET /api/providers   │  :3001              │
└─────────────────────┘                      └────────┬────────────┘
                                                      │ Provider Abstraction
                                          ┌───────────┼───────────┐
                                          ▼           ▼           ▼
                                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                                    │ Anthropic│ │ DeepSeek │ │ Custom   │
                                    │ Claude   │ │ (OpenAI) │ │ Proxy    │
                                    └──────────┘ └──────────┘ └──────────┘
```

### Provider Configuration

The backend supports 3 provider types, configured via `.env`:

| Provider | API Format | Use Case |
|----------|-----------|----------|
| `anthropic` | Anthropic SDK | Claude models (default) |
| `deepseek` | OpenAI-compatible | DeepSeek-Chat / DeepSeek-V3 |
| `custom` | OpenAI-compatible | Any third-party proxy / relay site |

- `.env` sets the default provider, API key, base URL, and model
- Frontend can override provider/model per request via optional fields in `POST /api/generate`
- `GET /api/providers` returns only providers with configured API keys

### Data Flow per Request
1. User pastes text + selects tone (+ optionally selects provider) → Frontend sends POST
2. Backend Step 1: Extract 3-6 core points from article
3. Backend Step 2: Generate 4 cover titles (XHS formulas) → SSE `titles` event
4. Backend Step 3: Generate 5 slide cards (50-80 chars each) → SSE `cards` event
5. Backend Step 4: Generate caption (200-300 chars) → SSE `caption` event
6. Backend Step 5: Generate 3-tier hashtags → SSE `tags` event
7. Frontend renders each section progressively as events arrive

## 6. Known Issues & Open Items

### Open Items
1. **Frontend model selector UI not yet built.** Backend `GET /api/providers` endpoint is ready; frontend needs a provider/model dropdown.
2. **No `.env` file committed.** Each developer must create `.env` from `.env.example` and add their own API keys.
3. **Prompt tuning required.** Current prompts are designed from best practices. DeepSeek output quality verified as good for knowledge-type content; other verticals and providers need testing.

### Resolved Issues
1. ~~Frontend-backend integration not done~~ → DONE (2026-03-31). Frontend reads real SSE stream.
2. ~~SSE crash on Windows~~ → Fixed (2026-03-31). Root cause: `req.on('close')` fired prematurely after `res.writeHead()` on Windows, aborting the LLM call. Fix: listen on `res.on('close')` instead.
3. ~~OpenAI SDK crash~~ → Replaced with axios for OpenAI-compatible providers. The `openai` npm package (v6) caused process crashes during SSE + async calls; axios is stable.

### Known Risks
1. **API cost not capped.** 5 LLM calls per conversion, no rate limiting or usage tracking in V1.
2. **No error retry.** If one of the 5 steps fails mid-stream, the entire generation fails. No partial recovery.
3. **No input sanitization beyond length check.** Pasted text may contain HTML, markdown, or ad content from WeChat articles.
4. **`tsx` not safe for production on Windows.** Must use `tsc && node dist/index.js` (the `npm run dev` script). The `tsx watch` mode crashes during SSE + async HTTP calls.

---
*Generated by Claude Code via decision-clarity session (2026-03-30)*
*Last updated: 2026-03-31 — Frontend-backend SSE integration complete, SSE crash fixed*
