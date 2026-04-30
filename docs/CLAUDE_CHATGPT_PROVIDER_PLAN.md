# Claude And ChatGPT Provider Support Plan

Status date: 2026-04-30

Execution status: implemented and self-tested.

## Goal

Add explicit Claude and ChatGPT model support to the generation system so users can choose between:

1. Claude models through Anthropic official API.
2. Claude models through third-party Anthropic-compatible API gateways.
3. ChatGPT/GPT models through OpenAI official API.
4. ChatGPT/GPT models through third-party OpenAI-compatible API gateways.
5. Existing DeepSeek and custom providers.

The feature should work consistently across all current generation flows:

- WeChat Official Account composer
- Official Account to Xiaohongshu rewrite
- Xiaohongshu original composer

## Current Findings

Current backend provider support:

- `anthropic`: already implemented through `AnthropicProvider`.
- `deepseek`: already implemented through `OpenAICompatProvider`.
- `custom`: already implemented through `OpenAICompatProvider`.

Current frontend support:

- Frontend loads `GET /api/providers`.
- Frontend renders provider and model selectors.
- Requests already pass optional `provider` and `model` fields to backend generation endpoints.

Current gap:

- Claude is technically present as `anthropic`, but the product language asks for explicit Claude support.
- ChatGPT/OpenAI is only possible through `custom`, which is not clear to users and requires manual base URL setup.
- Third-party Claude support is not explicit. Claude-compatible gateways usually need Anthropic-style request/stream parsing, not OpenAI-compatible parsing.
- Third-party ChatGPT/OpenAI support is currently possible through `custom`, but that name is too vague and does not distinguish OpenAI-compatible from Anthropic-compatible protocols.
- Provider validation lists only `anthropic`, `deepseek`, and `custom`.
- Documentation does not clearly explain official vs third-party Claude/ChatGPT setup.

## Product Decision

Recommended MVP:

- Keep `anthropic` as the internal provider id for Claude to avoid breaking existing config.
- Add `openai` as a first-class provider id for ChatGPT/GPT models.
- Add `anthropic_compat` as a first-class provider id for third-party Claude-compatible gateways.
- Add `openai_compat` as a first-class provider id for third-party ChatGPT/OpenAI-compatible gateways.
- Keep `custom` as a backward-compatible alias for `openai_compat` for one release cycle, then document it as legacy.
- Display user-facing names as:
  - `Claude 官方`
  - `Claude 第三方`
  - `ChatGPT / OpenAI 官方`
  - `ChatGPT / OpenAI 第三方`
  - `DeepSeek`
  - `Custom (Legacy)`

Reason:

- Claude support already exists and should not be duplicated.
- OpenAI deserves a first-class provider because users should not need to understand `custom` to use ChatGPT/GPT models.
- Claude-compatible third-party gateways should use the Anthropic protocol adapter, not the OpenAI-compatible adapter.
- OpenAI-compatible third-party gateways should remain separate from the official OpenAI config so keys/base URLs do not conflict.
- This keeps API compatibility while making the UI clearer.

## Provider Matrix

| User-facing provider | Internal id | Protocol adapter | Default base URL | Purpose |
|---|---|---|---|---|
| Claude 官方 | `anthropic` | Anthropic Messages API | `https://api.anthropic.com` | Official Claude API. |
| Claude 第三方 | `anthropic_compat` | Anthropic-compatible Messages API | env required | Third-party Claude gateway. |
| ChatGPT / OpenAI 官方 | `openai` | OpenAI-compatible Chat Completions API | `https://api.openai.com` | Official OpenAI API. |
| ChatGPT / OpenAI 第三方 | `openai_compat` | OpenAI-compatible Chat Completions API | env required | Third-party OpenAI gateway. |
| DeepSeek | `deepseek` | OpenAI-compatible Chat Completions API | `https://api.deepseek.com` | Existing DeepSeek support. |
| Custom (Legacy) | `custom` | OpenAI-compatible Chat Completions API | env required | Backward-compatible legacy alias. |

Implementation constraint:

- Do not route third-party Claude through `OpenAICompatProvider` unless the gateway explicitly exposes Claude models through OpenAI-compatible chat completions.
- The default third-party Claude path should use `AnthropicProvider` with a configurable base URL.

## Reference Model Defaults

Official docs checked on 2026-04-30:

- OpenAI models: `https://platform.openai.com/docs/models`
- OpenAI latest GPT guide: `https://platform.openai.com/docs/guides/latest-model`
- Anthropic Claude models: `https://platform.claude.com/docs/en/docs/models-overview`

Recommended default model values:

| Provider | Default model | Notes |
|---|---|---|
| Claude 官方 | `claude-sonnet-4-6` | Balanced speed/intelligence default if account supports it. |
| Claude 第三方 | configurable | Third-party gateways may use different Claude model aliases. |
| ChatGPT / OpenAI 官方 | `gpt-5.2` | General API default for high-quality generation. |
| ChatGPT-style OpenAI model | `gpt-5.2-chat-latest` | Optional if the goal is specifically ChatGPT-like behavior. |
| ChatGPT / OpenAI 第三方 | configurable | Third-party gateways often use custom model aliases. |
| DeepSeek | `deepseek-chat` | Existing default. |

Implementation note:

- Model values must remain environment-configurable.
- Do not hard-fail if an account does not have access to the newest model; surface provider errors clearly.
- Avoid hardcoding a long fixed model catalog unless we add model-list API support.

## Functional Breakdown

### F01: Provider Id And Type Expansion

Status: completed.

Implementation:

- Add `openai`, `openai_compat`, and `anthropic_compat` to backend `ProviderId`.
- Add the new provider ids to backend valid provider sets in config and route validation.
- Add `openai`, `openai_compat`, and `anthropic_compat` to frontend `ProviderId`.
- Keep `anthropic` id as-is, but display it as Claude.

Likely files:

- `opera-server-py/app/config.py`
- `opera-server-py/app/types.py`
- `opera-server-py/app/routes/generate.py`
- `opera-server-py/app/routes/compose.py`
- `opera-server-py/app/routes/wechat_compose.py`
- `opera-app/src/types.ts`

Self-test:

- Invalid provider still returns 400.
- `openai`, `openai_compat`, and `anthropic_compat` are accepted by all three generation endpoints.
- Existing `anthropic`, `deepseek`, and `custom` still validate.

Acceptance:

- Backend accepts `provider: "openai"`, `provider: "openai_compat"`, and `provider: "anthropic_compat"`.
- Frontend type checking accepts the new provider ids.
- Existing provider ids remain backward compatible.

### F02: Official And Third-Party Provider Configuration

Status: completed.

Implementation:

- Add official OpenAI environment variables:
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`, default `https://api.openai.com`
  - `OPENAI_MODEL`, default `gpt-5.2`
  - optional `OPENAI_CHATGPT_MODEL`, default `gpt-5.2-chat-latest`
- Add third-party OpenAI-compatible environment variables:
  - `OPENAI_COMPAT_API_KEY`
  - `OPENAI_COMPAT_BASE_URL`
  - `OPENAI_COMPAT_MODEL`
  - `OPENAI_COMPAT_MODELS`
- Add third-party Claude-compatible environment variables:
  - `ANTHROPIC_COMPAT_API_KEY`
  - `ANTHROPIC_COMPAT_BASE_URL`
  - `ANTHROPIC_COMPAT_MODEL`
  - `ANTHROPIC_COMPAT_MODELS`
- Add config validation for `AI_PROVIDER=openai`, `AI_PROVIDER=openai_compat`, and `AI_PROVIDER=anthropic_compat`.
- Ensure missing key errors are provider-specific.
- Require base URL for third-party providers.

Likely files:

- `opera-server-py/app/config.py`
- `.env.example`
- `docs/DEPLOYMENT.md`
- `README.md`

Self-test:

- Start backend with `AI_PROVIDER=openai` and no key; confirm clear startup/config error.
- Start backend with `AI_PROVIDER=openai_compat` and no base URL; confirm clear startup/config error.
- Start backend with `AI_PROVIDER=anthropic_compat` and no base URL; confirm clear startup/config error.
- Start backend with other providers and no OpenAI key; confirm no OpenAI error.
- Start backend with official Claude and no third-party Claude key; confirm no third-party Claude error.
- Confirm `.env.example` documents expected variables without real secrets.

Acceptance:

- OpenAI config is explicit.
- Third-party OpenAI config is explicit.
- Third-party Claude config is explicit.
- Secrets are not committed.
- Existing DeepSeek/custom/Claude config still works.

### F03: Provider Factory Branches

Status: completed.

Implementation:

- Add `openai` branch in `create_provider`.
- Reuse `OpenAICompatProvider` for Chat Completions-compatible calls.
- Use `OPENAI_BASE_URL` and `OPENAI_MODEL`.
- Add `openai_compat` branch using `OpenAICompatProvider`.
- Add `anthropic_compat` branch using `AnthropicProvider` with third-party base URL.
- Keep `custom` as legacy OpenAI-compatible relay config.

Likely files:

- `opera-server-py/app/providers/factory.py`

Self-test:

- Unit-test provider creation for `openai`.
- Unit-test provider creation for `openai_compat`.
- Unit-test provider creation for `anthropic_compat`.
- Unit-test missing `OPENAI_API_KEY`.
- Unit-test missing third-party base URLs.
- Confirm `custom` still uses `CUSTOM_*` as a legacy alias.

Acceptance:

- `create_provider(settings, "openai")` returns an OpenAI-compatible provider.
- `create_provider(settings, "openai_compat")` returns an OpenAI-compatible provider with third-party base URL.
- `create_provider(settings, "anthropic_compat")` returns an Anthropic-compatible provider with third-party base URL.
- OpenAI provider does not depend on `CUSTOM_BASE_URL`.
- Claude third-party provider does not depend on `CUSTOM_BASE_URL`.

### F04: Available Providers API

Status: completed.

Implementation:

- Add official OpenAI to `GET /api/providers` when `OPENAI_API_KEY` is configured.
- Add third-party OpenAI-compatible to `GET /api/providers` when `OPENAI_COMPAT_API_KEY` and base URL are configured.
- Add third-party Claude-compatible to `GET /api/providers` when `ANTHROPIC_COMPAT_API_KEY` and base URL are configured.
- Return user-facing names such as `ChatGPT / OpenAI 官方`, `ChatGPT / OpenAI 第三方`, `Claude 官方`, and `Claude 第三方`.
- Return configured models as a list.
- Include Anthropic with name `Claude`.

Recommended response example:

```json
{
  "default": "openai",
  "available": [
    { "id": "openai", "name": "ChatGPT / OpenAI 官方", "models": ["gpt-5.2", "gpt-5.2-chat-latest"] },
    { "id": "openai_compat", "name": "ChatGPT / OpenAI 第三方", "models": ["gpt-4o", "gpt-5.2"] },
    { "id": "anthropic", "name": "Claude 官方", "models": ["claude-sonnet-4-6"] },
    { "id": "anthropic_compat", "name": "Claude 第三方", "models": ["claude-sonnet-4-6"] }
  ]
}
```

Likely files:

- `opera-server-py/app/providers/factory.py`
- `opera-server-py/tests/test_api_contract.py`

Self-test:

- `GET /api/providers` includes official OpenAI only when official OpenAI key exists.
- `GET /api/providers` includes third-party OpenAI only when third-party OpenAI key and base URL exist.
- `GET /api/providers` includes third-party Claude only when third-party Claude key and base URL exist.
- Default provider remains valid and appears in available providers when configured.
- Provider names are user-facing and clear.

Acceptance:

- Frontend dropdown shows official and third-party providers as separate choices when configured.
- Claude appears as `Claude 官方` or `Claude 第三方`, not as technical-only `anthropic`.

### F05: Model List Strategy

Status: completed.

Recommended MVP:

- Use environment-configured model list, not live provider model-list APIs.

Implementation:

- Add optional comma-separated model env values:
  - `ANTHROPIC_MODELS`
  - `OPENAI_MODELS`
  - `ANTHROPIC_COMPAT_MODELS`
  - `OPENAI_COMPAT_MODELS`
  - `DEEPSEEK_MODELS`
  - `CUSTOM_MODELS`
- If list is empty, fallback to the single default model.
- Trim whitespace and remove duplicates.

Reason:

- Provider model-list APIs differ.
- API keys may not have access to every listed model.
- Static env lists are easy to test and deploy.

Likely files:

- `opera-server-py/app/config.py`
- `opera-server-py/app/providers/factory.py`

Self-test:

- Empty model list returns default model.
- Comma-separated list returns multiple dropdown options.
- Duplicate model names are removed.

Acceptance:

- Users can expose multiple official or third-party Claude/OpenAI models in the frontend without code changes.

### F06: Frontend Provider Display Cleanup

Status: completed.

Implementation:

- Extend frontend `ProviderId` type with `openai`, `openai_compat`, and `anthropic_compat`.
- Ensure ProviderSelector displays returned provider names directly.
- Optionally adjust helper copy from `provider/model` to `模型服务/模型`.
- Keep current provider/model selection behavior.

Likely files:

- `opera-app/src/types.ts`
- `opera-app/src/components/ProviderSelector.tsx`

Self-test:

- Mock `/api/providers` with official OpenAI, third-party OpenAI, official Claude, and third-party Claude.
- Switch provider and verify model dropdown resets to the provider default.
- Generate requests include selected provider/model.

Acceptance:

- Users can clearly choose official Claude, third-party Claude, official ChatGPT/OpenAI, or third-party ChatGPT/OpenAI in each tab.
- Selection works across all three tabs.

### F07: API Contract And Error Messages

Status: completed.

Implementation:

- Update route validation error messages to include `openai`, `openai_compat`, and `anthropic_compat`.
- Ensure invalid provider response remains 400.
- Normalize provider errors so missing key or provider HTTP failures are understandable.

Likely files:

- `opera-server-py/app/routes/generate.py`
- `opera-server-py/app/routes/compose.py`
- `opera-server-py/app/routes/wechat_compose.py`
- `opera-server-py/tests/test_api_contract.py`

Self-test:

- Invalid provider returns the full valid provider list, including official and third-party ids.
- Missing OpenAI key produces a clear server-side error.
- Missing third-party Claude/OpenAI base URL produces a clear server-side error.
- Provider HTTP failure still streams/returns an error event without crashing the server.

Acceptance:

- Error behavior is stable and test-covered.

### F08: Documentation Updates

Status: completed.

Implementation:

- Update README setup section.
- Update deployment provider configuration.
- Add examples:
  - Claude default
  - Claude third-party gateway
  - ChatGPT/OpenAI default
  - ChatGPT/OpenAI third-party gateway
  - official and third-party providers with multiple models
  - legacy Custom OpenAI-compatible relay
- Document that ChatGPT API model names and ChatGPT product names are not always identical.
- Document that Claude third-party gateways must declare whether they use Anthropic-compatible or OpenAI-compatible protocol.

Likely files:

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/PROJECT.md`
- `docs/PLAN.md`

Self-test:

- Read docs as a fresh setup path.
- Confirm no real secrets or local-only values are included.

Acceptance:

- User can configure Claude or ChatGPT/OpenAI by reading docs only.
- User can configure official or third-party Claude/ChatGPT by reading docs only.

### F09: Automated Tests

Status: completed.

Implementation:

- Update backend contract tests for OpenAI provider.
- Add provider availability tests for:
  - OpenAI key present
  - OpenAI key missing
  - multiple OpenAI model list
  - third-party OpenAI key/base URL present
  - third-party Claude key/base URL present
  - third-party provider missing base URL
  - invalid provider
- Frontend lint/build remains required.

Commands:

- `python -m pytest -q`
- `npm.cmd run lint`
- `npm.cmd run build`

Acceptance:

- Backend tests pass.
- Frontend lint/build pass.
- Docker full-stack smoke test remains deferred unless user explicitly approves it.

### F10: Optional Live Provider Verification

Status: completed.

Scope:

- Only run if valid API keys are available locally.

Implementation:

- Run E2E once with Claude.
- Run E2E once with OpenAI.
- Run E2E once with third-party Claude if credentials are available.
- Run E2E once with third-party OpenAI-compatible provider if credentials are available.
- Cover all three generation flows:
  - `/api/generate`
  - `/api/compose`
  - `/api/wechat/compose`

Command:

- `python scripts/test_e2e.py`

Acceptance:

- SSE generation completes for each configured provider.
- Provider failures are documented if the account lacks model access.

## Delivery Sequence

### Phase 1: Contract And Config

Status: completed.

Includes:

- F01 Provider Id And Type Expansion
- F02 Official And Third-Party Provider Configuration
- F03 Provider Factory Branches

Gate:

- Backend tests pass for provider selection and invalid provider cases.

### Phase 2: Provider Discovery And UI

Status: completed.

Includes:

- F04 Available Providers API
- F05 Model List Strategy
- F06 Frontend Provider Display Cleanup

Gate:

- `GET /api/providers` returns official and third-party Claude/OpenAI providers when configured.
- Frontend dropdown renders both.

### Phase 3: Docs And Verification

Status: completed.

Includes:

- F07 API Contract And Error Messages
- F08 Documentation Updates
- F09 Automated Tests
- F10 Optional Live Provider Verification

Gate:

- README and deployment docs are complete.
- Automated checks pass.
- Live provider E2E is either passed or explicitly skipped due to missing keys.

## Full Self-Test Checklist

Execution result:

- `python -m pytest -q`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed outside the restricted sandbox after the first sandbox run hit Windows `spawn EPERM` while loading the Tailwind native dependency.
- Live provider E2E was not run because this pass did not verify the presence of real Claude/OpenAI third-party credentials.
- Docker full-stack smoke test remains deferred by prior request.

Backend:

- `python -m pytest -q`
- `GET /api/providers` with only official Claude key.
- `GET /api/providers` with only third-party Claude key/base URL.
- `GET /api/providers` with only official OpenAI key.
- `GET /api/providers` with only third-party OpenAI key/base URL.
- `GET /api/providers` with Claude + OpenAI + DeepSeek.
- Invalid provider request returns 400.
- Missing OpenAI key produces a clear config/provider error.
- Missing third-party base URL produces a clear config/provider error.

Frontend:

- `npm.cmd run lint`
- `npm.cmd run build`
- Provider dropdown shows official and third-party Claude/ChatGPT providers separately.
- Model dropdown switches when provider changes.
- Generate requests include selected `provider` and `model`.

Manual:

- WeChat composer can select official and third-party Claude.
- WeChat composer can select official and third-party ChatGPT/OpenAI.
- Rewrite flow can select official and third-party Claude.
- Rewrite flow can select official and third-party ChatGPT/OpenAI.
- Xiaohongshu composer can select official and third-party Claude.
- Xiaohongshu composer can select official and third-party ChatGPT/OpenAI.

Deferred unless approved:

- Docker full-stack smoke test: `docker compose up --build`.

## Final Acceptance Criteria

The feature is acceptable when all of the following are true:

- Claude remains supported and is clearly displayed as Claude.
- ChatGPT/OpenAI is available as a first-class provider.
- Third-party Claude-compatible providers are available as a first-class provider type.
- Third-party OpenAI-compatible providers are available as a first-class provider type.
- Users can configure OpenAI through `OPENAI_*` environment variables.
- Users can configure third-party OpenAI through `OPENAI_COMPAT_*` environment variables.
- Users can configure third-party Claude through `ANTHROPIC_COMPAT_*` environment variables.
- Users can expose one or more official or third-party OpenAI/Claude models without code changes.
- All three generation flows accept and use the selected provider/model.
- Existing DeepSeek and custom provider behavior does not regress.
- README and deployment docs explain official and third-party Claude/ChatGPT setup.
- Backend tests pass.
- Frontend lint/build pass.
- Live provider verification is documented as passed or skipped due to missing credentials.

## Open Decisions For Review

1. OpenAI provider id: use `openai` internally, display `ChatGPT / OpenAI` in UI. Recommended: yes.
2. Third-party OpenAI provider id: use `openai_compat`. Recommended: yes.
3. Third-party Claude provider id: use `anthropic_compat`. Recommended: yes.
4. Legacy `custom`: keep as alias for OpenAI-compatible only. Recommended: yes.
5. Default OpenAI model: use `gpt-5.2` or `gpt-5.2-chat-latest`. Recommended: `gpt-5.2` for API quality, expose `gpt-5.2-chat-latest` as optional.
6. Default Claude model: use current configured `claude-sonnet-4-20250514` or update default to `claude-sonnet-4-6`. Recommended: keep existing default if current key is known to work; allow env override.
7. Model discovery: use env-configured lists or live model-list APIs. Recommended MVP: env-configured lists.
8. Live E2E: run only if official or third-party Claude/OpenAI keys are available locally. Recommended: yes.

## Recommended Review Decision

Approve the MVP:

- Add first-class `openai` provider.
- Add first-class `openai_compat` provider for third-party ChatGPT/OpenAI-compatible gateways.
- Add first-class `anthropic_compat` provider for third-party Claude-compatible gateways.
- Keep Claude under existing `anthropic` provider id but display it as Claude.
- Keep `custom` as a legacy OpenAI-compatible alias, not a Claude-compatible provider.
- Add official and third-party config, provider discovery, tests, and docs.
- Use env-configured model lists first.
- Defer live provider E2E unless valid keys are available.
