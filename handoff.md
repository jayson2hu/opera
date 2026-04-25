# Product Handoff: Opera Content Creation Workspace

## Executive Summary
Opera 已从单一的公众号转小红书工具升级为三入口内容创作工作台：`内容转换` 负责既有文章适配，`原创创作` 负责从主题想法直接生成可编辑的小红书帖子，`微信公众号` 负责从主题生成标题 / 摘要 / 正文并进入本地待同步草稿箱。

## 0. Latest Status (2026-04-03)
- 前端已落地 `Header + TabNav + AdapterPage + ComposerPage + WeChatPage` 三入口壳层
- `微信公众号` 已支持主题输入、文章类型 / 调性 / 篇幅选择、标题 / 摘要 / 正文生成、块级重生成、在线编辑与本地草稿箱待同步状态展示
- 后端默认基线继续收敛为 `opera-server-py/`，并新增 `POST /api/wechat/compose`；`opera-server/` 仅保留源码参考且运行链路已禁用
- 根目录已提供 `start-backend.ps1`、`start-backend.sh` 与 `docker-compose.yml`，覆盖 Windows、本地 Linux/macOS、Ubuntu Docker/Compose 场景
- 前端 API 基址已支持 `VITE_API_BASE_URL`；开发环境默认 `http://localhost:3001`，容器 / 生产环境默认同源 `/api`
- 当前轮验收已完成：`opera-app` build、`opera-server-py` `pytest -q`（`25 passed`）、`opera-server-py/scripts/test_e2e.py`（覆盖 `/api/generate`、`/api/compose`、`/api/wechat/compose`）与 `opera-server` 运行禁用保护验证通过；`docker compose config` 仍保持已通过状态
- 为避免误连占用 `:3001` 的旧服务，`scripts/test_e2e.py` 已改为随机空闲端口启动临时 FastAPI 进程；后端 JSON 提取逻辑也已增强，且 `/api/generate` 现会在入链前清洗公众号粘贴中的 HTML 标签、关注引导与阅读原文等噪音，降低真实 provider 输出与输入脏数据带来的失败概率
- 本机 Docker daemon 当前未运行，因此本轮未完成容器实际拉起烟测

## 1. Core Decision & Strategy
- **Positioning:** 从单一内容适配工具升级为 Content **Creation Workspace**；保留 Adaptation，同时新增从零创作能力，不做 Distribution (Publishing).
- **Core Problem:** "Format Friction" + "Blank Page Friction"——既解决已有长文改写成本，也解决从空白主题开始写小红书的启动成本。
- **Target User:** "The Overwhelmed Solo Creator"——既包括已有公众号内容的知识型创作者，也包括只有灵感、缺少成稿时间的个人创作者。

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

#### 1b. Backend (LEGACY SOURCE REFERENCE ONLY)
- **Location:** `opera-server/`
- **Tech Stack:** Node.js + Express + TypeScript + Multi-provider LLM (Anthropic / DeepSeek / Custom)
- **Status:** Preserved only for source comparison / rollback reference. The runtime and old Node acceptance entrypoints are now intentionally disabled.
- **Important:** Normal local development, acceptance, and cloud deployment must use `opera-server-py/` only.
- **File Structure:**
  ```
  opera-server/src/
    index.ts                  # Express server entry (runtime disabled by guard)
    config.ts                 # Legacy provider/env reference
    types.ts                  # Shared type definitions
    prompts.ts                # 5-step LLM prompt templates (core IP)
    providers/
      types.ts                # LLMProvider interface + ProviderId
      anthropic.ts            # Anthropic Claude provider
      openai-compat.ts        # OpenAI-compatible provider (axios-based)
      index.ts                # Provider factory + available providers query
    routes/generate.ts        # Legacy SSE handler + /api/providers contract reference
  ```
- **Run:** Do not start `opera-server/`. `npm run dev` / `npm start` / `npm run legacy:*` and `node test-e2e.mjs` now exit immediately and redirect to the FastAPI workflow.
- **API Endpoints:**
  - `POST /api/generate` — legacy contract reference only
  - `GET /api/providers` — legacy contract reference only
  - `GET /api/health` — legacy contract reference only

#### 1c. Frontend-Backend Integration (DONE)
- Frontend `App.tsx` calls `POST /api/generate` via `fetch` and reads SSE stream using `ReadableStream` reader.
- Each SSE event (`titles`, `cards`, `caption`, `tags`) maps to component state for progressive rendering.
- Error events display inline error message in the UI.
- Frontend provider/model selector UI is now built. The app loads `GET /api/providers`, defaults to the backend default provider, and passes optional `provider` / `model` overrides in `POST /api/generate`.

#### 1d. Backend (DONE - Default runtime)
- **Location:** `opera-server-py/`
- **Tech Stack:** Python + FastAPI + Pydantic Settings + httpx + Uvicorn
- **Status:** Final cutover complete. `opera-server-py/` is now the only supported backend runtime for local development, validation, and future feature work.
- **Compatibility Goal:** Same `http://localhost:3001` dev base URL, same `/api/health`, `/api/providers`, `/api/generate`, same request body, same SSE event names/order/fields.
- **Default Start (Windows):** From repo root run `.\start-backend.ps1`
- **Default Start (Linux/macOS):** From repo root run `./start-backend.sh`
- **Default Full Stack (Docker/Ubuntu):** From repo root run `docker compose up --build`
- **Direct Run:** `cd opera-server-py && cp .env.example .env && python -m pip install -e ".[dev]" && python -m uvicorn app.main:app --host 127.0.0.1 --port 3001`
- **Validation:**
  - `cmd /c "cd /d d:\vscodefile\opera\opera-app && npm run build"` → passed
  - `D:\software\anacond\python.exe -m pytest -q` → passed (`12 passed`)
  - `D:\software\anacond\python.exe scripts/test_e2e.py` → passed，覆盖 `/api/generate` 与 `/api/compose`
  - `cmd /c "cd /d d:\vscodefile\opera\opera-server && npm run typecheck"` → passed
  - `cmd /c "cd /d d:\vscodefile\opera\opera-server && npm run legacy:dev"` → 正常拒绝启动并提示切回 FastAPI
  - `docker compose config` → passed；本机 Docker daemon 未运行，故未完成 `compose up` 实机烟测
- **Role of `opera-server/`:** Keep only as source reference and contract history; not part of run / acceptance / deployment flows.

#### 1e. WeChat Composer (DONE - Phase 1)
- **Frontend:** `opera-app/src/pages/WeChatPage.tsx` + `opera-app/src/components/wechat/*`
- **Backend:** `opera-server-py/app/routes/wechat_compose.py` + `opera-server-py/app/prompts_wechat.py`
- **Scope:** 从选题生成公众号标题 / 摘要 / 正文，支持在线编辑、块级重生成、复制全文、本地草稿箱待同步状态
- **Boundary:** 当前不接公众号真实账号，不做官方草稿同步、素材上传或真实发布
- **Validation:**
  - `cmd /c "cd /d d:\vscodefile\opera\opera-app && npm run build"` → passed
  - `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe -m pytest -q"` → passed (`25 passed`)
  - `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe scripts\test_e2e.py"` → passed，覆盖 `/api/wechat/compose`

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
┌─────────────────────┐     SSE Stream      ┌──────────────────────┐
│   opera-app (FE)    │ ◄──────────────────► │ opera-server-py (BE) │
│   React + Vite      │  POST /api/generate  │ FastAPI + Python     │
│   :5173             │  GET /api/providers   │ :3001                │
└─────────────────────┘                      └─────────┬────────────┘
                                                       │ Provider Abstraction
                                           ┌───────────┼───────────┐
                                           ▼           ▼           ▼
                                     ┌──────────┐ ┌──────────┐ ┌──────────┐
                                     │ Anthropic│ │ DeepSeek │ │ Custom   │
                                     │ Claude   │ │ (OpenAI) │ │ Proxy    │
                                     └──────────┘ └──────────┘ └──────────┘
```

Default local backend start entries are `start-backend.ps1` and `start-backend.sh`, which launch `opera-server-py/` on `:3001`.
For Ubuntu / Docker, `docker compose up --build` serves the frontend on `:8080` and proxies `/api` to the FastAPI backend on `:3001`.

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
1. **No `.env` file committed.** Each developer must create `.env` from `.env.example` and add their own API keys.
2. **Prompt tuning required.** Current prompts are designed from best practices. DeepSeek output quality verified as good for knowledge-type content; other verticals and providers need testing.
3. **FastAPI real-key verification is currently complete with the locally configured default provider only.** Anthropic/custom still need live-key verification when those credentials are available.
4. **Future backend feature work should target `opera-server-py/` only.** `opera-server/` remains available only for source comparison and contract history.
5. **If `POST /api/compose` or `POST /api/wechat/compose` returns `404 {"error":"Not found"}`, the request is not reaching the default FastAPI backend.** Restart with repo-root `start-backend.ps1` / `start-backend.sh`, or bring up the stack with `docker compose up --build`.
6. **微信公众号当前仅为本地草稿箱待同步方案。** 尚未接官方账号授权、草稿同步或真实发布链路。

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
*Last updated: 2026-04-03 — WeChat Composer Phase 1, FastAPI self-test hardening, and verification notes synced*
