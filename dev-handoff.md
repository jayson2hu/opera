# Development Handoff: Opera

## Latest Status (2026-04-03)

微信公众号 Phase 1 已完成当前轮开发、自测与交接同步：前端工作台现为三入口（`内容转换` / `原创创作` / `微信公众号`），其中 `微信公众号` 支持主题生成标题 / 摘要 / 正文、块级重生成、在线编辑，以及本地草稿箱待同步状态展示；默认后端继续以 `opera-server-py/` 为唯一运行基线，并新增 `POST /api/wechat/compose`。

当前验收基线为：`opera-app` build 通过、`opera-server-py` `pytest -q` 通过（`25 passed`）、`opera-server-py/scripts/test_e2e.py` 通过（覆盖 `/api/generate`、`/api/compose`、`/api/wechat/compose`），以及 `opera-server` 运行禁用保护验证通过。另已修复真实 key 自测偶发失败问题：`scripts/test_e2e.py` 现改为使用随机空闲端口启动临时服务，`app/utils.py` 既增强了 fenced JSON / 前置说明文本解析兼容性，也新增公众号粘贴文稿预处理，可剥离 HTML 标签、关注引导、阅读原文等常见噪音。

已同步排障与部署策略：若浏览器请求 `POST /api/compose` 或 `POST /api/wechat/compose` 返回 `404 {"error":"Not found"}`，说明请求没有打到默认的 FastAPI 后端；应从仓库根目录运行 `start-backend.ps1`、`./start-backend.sh`，或使用 `docker compose up --build`。`opera-server/` 现仅保留源码参考，`npm run dev` / `npm start` / `npm run legacy:*` 与 `node test-e2e.mjs` 均会直接拒绝启动。后续每轮开发完成后，仍需先执行相关自测再交付。

## Change Log

### 2026-04-03 (10): Generate Input Preprocessing + Acceptance Refresh

**Feature Added: 公众号长文粘贴预处理，降低 HTML / 关注引导 / 阅读原文噪音对 `/api/generate` 的干扰**

What changed:
- `app/utils.py` 新增 `preprocess_article_text()`，在进入 `/api/generate` prompt 前统一做 HTML 解码、块级标签换行、URL-only 行过滤与常见公众号尾注/关注引导剥离
- `app/routes/generate.py` 改为基于预处理后的正文做校验与 prompt 构造，避免把粘贴噪音直接送入提取、标题、卡片、正文与标签链路
- `tests/test_utils.py` 新增输入预处理单测，`tests/test_api_contract.py` 新增粘贴噪音合同测试

Verification:
- `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe -m pytest -q"` → PASS (`25 passed`)
- `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe scripts\test_e2e.py"` → PASS（覆盖 `/api/generate` + `/api/compose` + `/api/wechat/compose`）
- 首次重跑 `scripts/test_e2e.py` 时 `/api/compose` 曾出现一次瞬时 `ConnectError`，随即复跑通过，当前判断为真实 provider / 网络瞬时抖动，不属于本次预处理改动引入的问题

Current remaining gaps:
- 公众号仍未接真实账号，当前仅支持本地草稿箱与待同步状态，不支持官方草稿同步或真实发布
- 本机 Docker daemon 未启动，因此本轮未完成 `docker compose up --build` 的容器实际拉起验证
- Anthropic/custom provider 仍需在有真实 key 时继续做补充验收

### 2026-04-03 (9): WeChat Composer Phase 1 + Robust FastAPI Self-Test

**Feature Added: 三入口工作台中的「微信公众号」原创写作链路 + `/api/wechat/compose` + 本地草稿箱待同步状态**

What changed:
- `opera-app` 新增第三个 Tab `微信公众号`，落地 `WeChatPage`、文章类型选择、摘要编辑卡片与草稿箱面板
- `opera-server-py` 新增 `/api/wechat/compose`、`prompts_wechat.py`、相关类型合同与接口测试
- `scripts/test_e2e.py` 扩展覆盖 `/api/wechat/compose`，并改为随机空闲端口启动临时服务，避免 `:3001` 被占用时误连旧服务
- `app/utils.py` 的 `extract_json()` 已增强，对 fenced JSON 与带前置说明的模型输出更稳健
- 文档基线已回写到 `feature-wechat-composer/PRD.md`、`handoff.md`、`dev-handoff.md`、`opera-server-py/HANDOFF-FASTAPI.md`、`opera-app/DESIGN.md`

Verification:
- `cmd /c "cd /d d:\vscodefile\opera\opera-app && npm run build"` → PASS
- `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe -m pytest -q"` → PASS (`22 passed`)
- `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe scripts\test_e2e.py"` → PASS（覆盖 `/api/generate` + `/api/compose` + `/api/wechat/compose`）
- `cmd /c "cd /d d:\vscodefile\opera\opera-server && npm run legacy:dev"` → PASS（按预期拒绝启动并提示切回 FastAPI）

Current remaining gaps:
- 公众号仍未接真实账号，当前仅支持本地草稿箱与待同步状态，不支持官方草稿同步或真实发布
- 本机 Docker daemon 未启动，因此本轮未完成 `docker compose up --build` 的容器实际拉起验证
- Anthropic/custom provider 仍需在有真实 key 时继续做补充验收

### 2026-04-02 (8): Python-Only Runtime + Linux/Docker Delivery Baseline

**Feature Added: FastAPI-only run path, Linux startup script, Docker/Compose delivery baseline**

What changed:
- Added repo-root `start-backend.sh` for Linux/macOS local startup
- Added `opera-server-py/Dockerfile`, `opera-app/Dockerfile`, `opera-app/nginx.conf`, and repo-root `docker-compose.yml`
- Frontend API base now supports `VITE_API_BASE_URL`; dev defaults to `http://localhost:3001`, production/container mode defaults to same-origin `/api`
- Disabled `opera-server/` runtime entrypoints and retired `opera-server/test-e2e.mjs` from the acceptance chain
- Synced `CLAUDE.md`, `handoff.md`, `dev-handoff.md`, `opera-server-py/HANDOFF-FASTAPI.md`, `opera-app/README.md`, and `feature-xhs-composer/PRD.md`

Verification:
- `cmd /c "cd /d d:\vscodefile\opera\opera-app && npm run build"` → PASS
- `cmd /c "cd /d d:\vscodefile\opera\opera-server && npm run typecheck"` → PASS
- `cmd /c "cd /d d:\vscodefile\opera\opera-server && npm run legacy:dev"` → PASS（按预期拒绝启动并提示切回 FastAPI）
- `D:\software\anacond\python.exe -m pytest -q` in `opera-server-py` → PASS (`12 passed`)
- `D:\software\anacond\python.exe scripts/test_e2e.py` in `opera-server-py` → PASS（覆盖 `/api/generate` + `/api/compose`）
- `docker compose config` → PASS

Current remaining gaps:
- 本机 Docker daemon 未启动，因此本轮未完成 `docker compose up` 的容器实际拉起验证
- Anthropic/custom provider 仍需在有真实 key 时继续做补充验收

### 2026-04-02 (7): Composer Phase 1 Resume + Acceptance Baseline

**Feature Added: 双入口内容创作工作台 + `/api/compose` 真流式原创创作**

What changed:
- `opera-app` 已拆分为 `App shell + TabNav + AdapterPage + ComposerPage`
- 新增原创创作参数区、可编辑标题/正文/标签卡片、配图建议区、复制全文与置灰「即将上线」按钮
- `opera-server-py` 新增 `/api/compose`、Composer prompts、provider `stream()` 能力与 `regenerate` 字段
- 文档基线已回写到 `feature-xhs-composer/PRD.md`、`opera-app/DESIGN.md`、`handoff.md`、`dev-handoff.md`、`opera-server-py/HANDOFF-FASTAPI.md`

Verification:
- `cmd /c "cd /d d:\vscodefile\opera\opera-app && npm run build"` → PASS
- `cmd /c "cd /d d:\vscodefile\opera\opera-server-py && D:\software\anacond\python.exe -m pytest -q"` → PASS (`12 passed`)
- 本地真实流式烟测：`/api/generate` 返回 `10` 个 SSE 事件；`/api/compose` 返回标题、正文增量、标签与 `done` 事件，正文 chunk 持续增长

Current remaining gaps:
- 仍缺少浏览器端人工走查截图级验收记录
- `scripts/test_e2e.py` 的独立长耗时脚本本轮未再次执行，当前以更快的本地流式烟测作为交付前验证

### 2026-04-01 (6): FastAPI Final Cutover + Baseline Sync

**Feature Added: default backend entry and final FastAPI cutover**

The repository default backend has been formally switched to `opera-server-py/`.

What changed:
- Added repo-level default startup entry: `start-backend.ps1`
- Updated project handoff, development handoff, FastAPI backend handoff, `CLAUDE.md`, and `feature-xhs-composer/PRD.md`
- Marked `opera-server/` as legacy rollback/reference only
- Kept the frontend contract unchanged so existing `opera-app` calls continue to work without code changes

Verification:
- `start-backend.ps1` startup smoke + `GET /api/health` → PASS
- Existing FastAPI validation remains the baseline:
  - `D:\software\anacond\python.exe -m pytest` in `opera-server-py` → `6 passed`
  - `D:\software\anacond\python.exe scripts/test_e2e.py` → PASS with real local API key
  - `opera-server/test-e2e.mjs` against FastAPI server → PASS, `10/10` SSE events received

Current remaining gaps:
- Anthropic/custom providers are contract-compatible but not yet verified with live keys in the FastAPI backend
- Prompt quality across multiple verticals still needs follow-up tuning


### 2026-04-01 (5): FastAPI Parallel Backend Replatform

**Feature Added: Python FastAPI backend in parallel directory**

A new backend was added in `opera-server-py/` instead of replacing `opera-server/`. The goal was strict frontend zero-change compatibility while moving runtime responsibilities from Node/Express to FastAPI.

What changed:
- Added `opera-server-py/` with FastAPI app entry, config layer, prompts, provider factory, providers, routes, contract tests, and real-key E2E script
- Preserved the existing API contract:
  - `GET /api/health`
  - `GET /api/providers`
  - `POST /api/generate`
  - identical request body fields and SSE event names / order / payload keys
- Kept Node backend untouched as rollback/reference implementation
- Added `opera-server-py/HANDOFF-FASTAPI.md` as migration + validation baseline

Verification:
- `D:\software\anacond\python.exe -m pytest` in `opera-server-py` → `6 passed`
- `D:\software\anacond\python.exe scripts/test_e2e.py` → PASS with real local API key, including health/providers/error cases/full SSE generation
- Existing `opera-server/test-e2e.mjs` executed against the FastAPI server → PASS, 10/10 SSE events received

Current remaining gaps:
- Anthropic/custom providers are contract-compatible but not yet verified with live keys in the new FastAPI backend


### 2026-04-01 (4): Frontend Provider / Model Selector

**Feature Added: provider/model selector UI**

Frontend now calls `GET /api/providers` on load, renders a provider dropdown and model dropdown, and includes optional `provider` / `model` fields in `POST /api/generate`.

What changed:
- Added `ProviderSelector` component in `opera-app/src/components/ProviderSelector.tsx`
- Added provider-related frontend types in `opera-app/src/types.ts`
- Updated `opera-app/src/App.tsx` to load available providers, default to backend default provider, and send request overrides

Verification:
- `cd opera-app && npm run build` ✅
- Verified TypeScript compile + Vite production build succeeds
- Not yet manually verified against live Anthropic/custom keys

Current remaining gaps:
- Anthropic/custom provider real-key E2E verification still pending
- Prompt quality across multiple verticals still pending
- Input preprocessing for pasted WeChat artifacts still pending


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

1. ~~**Frontend model selector UI**~~ — DONE (2026-04-01)
2. **Anthropic / custom provider E2E verification** — test with real keys, confirm SSE pipeline works end-to-end for non-DeepSeek providers
3. **Prompt tuning per provider** — test with real articles across verticals (职场/教育/成长/生活方式)
4. **Input preprocessing** — strip WeChat article artifacts (HTML tags, ads, trailing subscription prompts)
