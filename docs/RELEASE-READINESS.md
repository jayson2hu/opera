# Release Readiness

## Progress checkpoint — 2026-09-12

The user requested a progress record and remote repository push, not a release. Local checks were rerun: frontend 130 tests / 18 files, backend 164 tests, ESLint, TypeScript/Vite build, and Ruff all passed (one existing backend deprecation warning). See [progress and push scope](PROGRESS-2026-09-12.md). Browser, Docker, and paid live-model gates remain open; **NO-GO remains unchanged**. Pushing a feature branch does not trigger the current main/PR-only CI configuration and is not CI approval.

## Current decision — 2026-09-10, 18:28 CST

**NO-GO for release / pending hands-on acceptance.** The previous Conditional GO below is superseded after the product re-review found draft-loss paths. The agreed W0–W4 implementation and deterministic regression are complete; W5 browser, Docker, and live-provider gates remain open.

The current scope retains all three workflows, adds versioned local drafts and candidate approval, passes current content to partial-generation APIs, and replaces heuristic publish estimates with explainable checks. See [implementation ledger](PRODUCT-IMPROVEMENT-IMPLEMENTATION.md) for decisions, fixed defects, and limitations, and [acceptance handbook](DRAFT-WORKSPACE-CONTRACT.md) for the remaining matrix.

| Current-worktree check | Result |
|---|---|
| Frontend Vitest | 130 passed / 18 files |
| Frontend ESLint | Passed, no findings |
| TypeScript + Vite build | Passed; JS 397.18 kB / 116.05 kB gzip |
| Backend pytest | 164 passed; one existing Starlette/httpx deprecation warning |
| Backend Ruff | Passed |
| git diff --check | Passed, only line-ending conversion warnings |
| Browser interaction / lifecycle / responsive / accessibility | NOT RUN; no browser-control tool is available in this session |
| Docker build/start smoke | NOT RUN; prior deferral retained |
| Paid live-model end-to-end | NOT RUN; no quota consumed |

Backend tests used the bundled Python runtime with PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 only in the test process to avoid unrelated broken global plugins. SSR page tests and real-hook synchronous callback tests are not browser lifecycle or visual acceptance. Public exposure without authentication remains out of scope and NO-GO. No commit or push was performed.

## Historical record — superseded, not evidence for the current worktree

The original text below is retained for traceability only. Its completion labels and GO decision must not be used as current release approval.


Status date: 2026-09-10

## Historical decision (superseded)

The optimized Opera worktree has passed code freeze and the available automated release
gates. The frontend rewrite, backend protocol hardening, local-draft safeguards, and
deployment contracts are implemented and independently rechecked.

Release status is **Conditional GO for a private/local MVP**. Three environment-dependent
acceptance gates remain open:

1. the full Chrome/Edge/Safari/iOS Safari responsive and keyboard matrix;
2. a real Docker image build/start/health smoke (Docker Hub access is currently blocked);
3. one paid live-provider end-to-end generation journey.

Opera remains **NO-GO for unauthenticated public internet or SaaS exposure**. The API has
no end-user authentication, per-user rate limits, spend quotas, abuse controls, or
production monitoring. Keep the MVP behind localhost, a VPN, or an access-controlled
reverse proxy.

The implementation is still an uncommitted worktree. The evidence below applies to this
exact worktree and must be rerun by CI on the eventual release commit.

## Historical delivered scope

| Area | Status | Delivered behavior |
|---|---|---|
| Home optimization (H1-H3) | Complete | Hero/flow hierarchy, real recent-draft progress, draft drawer, append-only local creation activity, streak and monthly active-day metrics. |
| Composer optimization (C1-C4) | Complete | Step navigation, live quality checks, heuristic publish estimate, keyboard shortcuts, responsive workbench, phone preview, editing/regeneration. |
| Adapter optimization (A1-A3) | Complete | Backward-compatible `cards` + typed `cards_v2`, image export, selection/export workflows, tone regeneration with latest-edit rollback safety. |
| Design system (S1-S3) | Complete | Shadow tokens, loading/feedback states, dark/system theme, persisted preferences, conditional export watermark. |
| WeChat workbench | Complete for MVP | Streaming title/digest/body, editing and paragraph rewrite, complete-result identity, safe browser-local manual drafts. No real platform publishing. |
| Backend protocol hardening | Complete | Strict payload/output validation, safe SSE errors, EOF/truncation/refusal handling, bounded provider timeouts, model allowlist, exact CORS allowlist. |
| Deployment contract | Complete | Reproducible frontend install, Compose API-base interpolation, CI contract check, documented cross-origin configuration. |

Out of MVP: real Xiaohongshu/WeChat publishing, cloud drafts, account binding,
collaboration, billing, analytics, and remote asset management.

## Historical verification evidence

Checks executed against the final worktree on 2026-09-10:

| Check | Result | Notes |
|---|---|---|
| `npm --prefix opera-app run test` | **89 passed / 13 files** | Covers SSE terminal integrity, draft persistence/identity, activity metrics, card protocol fallback/export, preferences, quality checks, focus boundaries, and WeChat storage failure. |
| `npm --prefix opera-app run lint` | **Passed** | ESLint completed with no findings. |
| `npm --prefix opera-app run build` | **Passed** | Vite 8.1.5; 83 modules; JS 393.20 kB / 114.50 kB gzip; CSS 87.52 kB / 13.76 kB gzip. |
| `npm --prefix opera-app ci --dry-run --ignore-scripts` | **Passed** | Lockfile and `npm ci` dependency graph resolve successfully. |
| Backend `pytest` | **123 passed** | One existing Starlette/httpx deprecation warning; no live provider call. |
| `python -m ruff check app tests scripts` | **Passed** | Includes the Compose contract script in `opera-server-py/scripts`. |
| Python AST syntax pass | **30 files passed** | No-cache parse of application, tests, and scripts. |
| `docker compose config --quiet` | **Passed** | Compose structure and environment references are valid. |
| `python opera-server-py/scripts/check_compose_api_base.py` | **Passed** | Verifies unset API base becomes empty and a custom origin is passed through exactly. |
| Runtime backend smoke on `127.0.0.1:3003` | **Passed** | `/api/health=200`, `/api/providers=200`; latest backend restarted successfully. |
| Runtime security contract smoke | **Passed** | Allowed local CORS preflight `200`; unlisted origin `400` without allow-origin header; unapproved model override `400`. |
| Frontend/backend wiring on `127.0.0.1:5174` | **Passed** | Frontend `200` and the dev bundle targets `http://127.0.0.1:3003`. |
| `git diff --check` | **Passed** | No whitespace errors; Windows LF/CRLF conversion warnings only. |
| Docker engine | **Available** | Docker Desktop 28.0.4 responds. |
| Docker image build/start smoke | **Blocked** | `auth.docker.io:443` refused metadata pulls and required base images are not cached locally. No test containers were started and ports 3001/8080 were not touched. |
| Full browser/device matrix | **Not executed** | Browser-control capability is unavailable in this task; do not treat static/build evidence as browser acceptance. |
| Live provider E2E | **Not executed** | Requires configured credentials, provider availability, and paid calls. |
| CI on release commit | **Not executed** | The optimized worktree has not yet been committed/pushed. |

## Closed Release Defects

- Composer and WeChat complete results now carry an identity over topic/type/tone/length/
  provider/model. Parameter changes cannot restore, save, or locally regenerate an old
  result as if it belonged to the new settings.
- Legacy drafts without identity remain compatible while provider discovery is loading;
  saved provider/model selections are verified once available.
- WeChat refuses to save or restore partial title/digest/body output as a completed draft.
  Manual storage failures keep `not_saved` and show an error instead of false success;
  legacy raw-array draft storage remains readable.
- Adapter tone regeneration snapshots a deep copy of the latest user-edited result. A
  failed/interrupted retry preserves the source draft and restores its original tone and
  parameter identity.
- Typed `cards_v2` is additive. Legacy `cards` remains emitted and is retained by the
  frontend when a malformed typed event follows a valid legacy event.
- Canvas export includes Chinese line-break constraints, truncation ellipsis, high-DPI
  rendering, conditional watermarking, and all single/selected/all export entry points.
- Modal focus trapping handles Escape, forward/reverse Tab escape, real opener return,
  removed-menu fallback to the avatar, and excludes `body`/`documentElement` as false
  return targets. Keyboard-focused paragraph tools are visible via `focus-within`.
- Composer phone preview no longer compresses the editor at 1024/1280 widths; the fixed
  preview column starts at the `2xl` breakpoint.
- Provider streams have bounded HTTP timeouts and distinguish safety refusal, token
  truncation, timeout, malformed output, and incomplete EOF without emitting false `done`.
- Extraction points and generated list fields are strictly validated. Non-string enum
  values return stable `400` responses instead of server errors.
- Explicit model overrides must belong to the configured model list for the selected
  provider; omitted model values remain backward compatible.
- `CORS_ORIGINS` supports an exact comma-separated allowlist with safe local defaults.
  Wildcards, userinfo, paths, queries, fragments, empty values, and invalid ports fail at
  startup.
- Compose now forwards the build-time `VITE_API_BASE_URL`; Bash and PowerShell deployment
  examples and a CI contract check prevent regression.

## Release Gates

### Passed for code freeze

- [x] Frontend unit/contract tests, lint, typecheck, and production build.
- [x] Backend unit/integration/contract tests, Ruff, and syntax validation.
- [x] SSE legacy compatibility and malformed/incomplete terminal handling.
- [x] Draft identity, incomplete-result, storage-failure, and tone-regeneration rollback tests.
- [x] CORS and configured-model boundary tests plus local runtime smoke.
- [x] Compose configuration and API-base interpolation contract.
- [x] Release-tree artifacts ignored without deleting local files: `.tmp-new-api/`,
  `opera.zip`, and the root one-time `scripts/` codemod workspace.

### Required before private/local release sign-off

- [ ] Create a deliberate release commit, selectively include product files and
  `opera-server-py/scripts/check_compose_api_base.py`, then run GitHub Actions on that
  exact commit.
- [ ] Restore access to Docker Hub or a mirror; build all images and run the backend
  health plus one frontend journey on non-conflicting test ports. Port 3001 belongs to an
  unrelated local service and 8080 is also occupied on this machine.
- [ ] Run at least one successful live-provider journey, including one adapter
  `paused -> /generate/continue -> done` sequence and a paragraph rewrite.
- [ ] Complete and record the browser checklist below.

### Required before public/SaaS exposure

- [ ] Add authentication and explicit tenant/user ownership.
- [ ] Add request/rate/token/spend quotas and abuse controls.
- [ ] Add request IDs, provider latency/error/usage metrics, alerting, and an incident
  owner/runbook.
- [ ] Define and test phased rollout plus rollback to a previous immutable image.

### Non-blocking follow-up hardening

- [ ] Pass currently edited title/body/digest as optional context for block-level
  regeneration; the existing tags path can regenerate hidden content and spend extra
  model calls before returning tags.
- [ ] Add a frontend container healthcheck and an image-build job to CI.
- [ ] Pin backend dependency resolution with a constraints or lock file.
- [ ] Add DOM-level focus integration tests in addition to the current deterministic
  focus-boundary tests.
- [ ] Run Lighthouse after browser acceptance (desktop target >=90, mobile >=80,
  FCP <=1.5 s).

## Browser Acceptance Checklist

Record browser, OS, viewport, result, screenshot, and defect link for each run.

- [ ] **Viewports:** 1440, 1280, 1024, 920, 768, and 390 px; no horizontal overflow or
  unusably compressed editor pane.
- [ ] **Browsers:** Chrome, Edge, Safari, and iOS Safari.
- [ ] **Home:** hero/flow cards, real draft progress, creation-day metrics, horizontal
  mobile draft scrolling, and “view all” drawer focus return.
- [ ] **Adapter:** 50+ character input, extraction pause/cancel/continue, typed and legacy
  cards, editing, selection/copy, single/selected/all PNG export, watermark preference,
  tone retry success and interrupted/failure rollback.
- [ ] **Composer:** step navigation, quality/estimate updates after editing, shortcuts,
  paragraph rewrite, image ordering, phone preview, theme switching, and responsive split.
- [ ] **WeChat:** generation, editing, partial-output save rejection, successful manual
  save/load, simulated storage failure, copy, and conversion to Adapter.
- [ ] **Global keyboard/accessibility:** Tab order, visible focus, Escape close, forward
  and reverse focus trap, opener focus restoration, reduced motion, and dialog labels.

## Go / No-Go Summary

- **Code freeze: GO.** No open P0/P1 was found after the final independent diff review.
- **Private/local MVP: Conditional GO.** Automated gates and local service contracts pass;
  Docker, live-provider, and full browser evidence remain mandatory for final sign-off.
- **Public internet/SaaS: NO-GO.** Do not expose the API until identity, quotas, abuse
  protection, observability, and rollback controls are implemented and verified.
