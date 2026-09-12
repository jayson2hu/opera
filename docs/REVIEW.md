# Review Notes

Review date: 2026-04-28

## Scope

Reviewed project layout, documentation, startup scripts, deployment configuration, frontend package scripts, FastAPI backend routes, and current repository hygiene.

## Findings

1. Frontend build passes in the real local environment.
   `npm.cmd run build` fails only inside the restricted command sandbox because Vite/Tailwind needs to spawn native helper processes. Running the same command outside the sandbox succeeds.

2. Several historical documents contain mojibake.
   Affected legacy docs were moved under `docs/archive/` and `docs/features/` for traceability, but they should not be treated as authoritative until the content is repaired.

3. `docker compose config` expands values loaded from `opera-server-py/.env`.
   The command is useful for validation, but its output can include real provider API keys. Do not paste raw output into issues, logs, or chat.

4. Runtime ownership is split historically but operationally clear.
   `opera-server-py/` is the supported backend. `opera-server/` is retained only as reference and its runtime scripts intentionally fail.

5. Docker deployment path exists and is coherent.
   `docker-compose.yml` builds the FastAPI backend and Vite/Nginx frontend, wires backend health checks, and proxies `/api/*` from frontend Nginx to the backend service.

6. Secrets hygiene is acceptable at the repository level.
   `.env` is ignored by `.gitignore`; `.env.example` files are present for configuration guidance.

## Validation Performed

Completed:

- `python -m pytest -q` in `opera-server-py/`: passed, 25 tests.
- `python scripts/test_e2e.py` in `opera-server-py/`: passed with real provider credentials, covering `/api/generate`, `/api/compose`, and `/api/wechat/compose`.
- `npm.cmd run lint` in `opera-app/`: passed.
- `npm.cmd run build` in `opera-app/`: passed when run outside the restricted sandbox.
- Content rewrite improvement validation: `/api/generate` live E2E passed with 6 title options and 7 slide cards.
- `docker compose config`: passed previously, with warnings that Docker config under the user profile could not be read.

## Recommended Follow-Up

- Run full Docker startup smoke test with `docker compose up --build` when Docker Engine validation is approved.
- Re-enable or rebuild PowerShell profile initialization if conda/chocolatey shell helpers are needed interactively.
- Revisit the user-level Git ignore permission issue outside this repository if global Git ignore behavior is needed.
- Consider moving active generated runtime logs out of the repository root in a future cleanup.

---

## 2026-06-09 — SSE client + route deduplication refactor

### Summary
Removed the duplicated streaming/parsing logic on both ends and fixed a latent SSE
event-loss bug, with no product or API behavior change.

### Changes Made
- Frontend: added `opera-app/src/lib/sse.ts` (`streamSSE`) and refactored `AdapterPage`,
  `ComposerPage`, and `WeChatPage` onto it. The previous per-page parser declared its
  event type inside the read loop and split on every newline, so an event whose `event:`
  and `data:` lines fell in different network chunks was silently dropped. The shared
  parser buffers on the SSE event boundary (blank line), persists state across chunks,
  and skips malformed frames instead of tearing down the stream.
- Frontend: lazy-initialized WeChat draft state and annotated the Adapter prop-sync
  effect to clear two `react-hooks/set-state-in-effect` errors that the refactor
  un-masked (the analyzer previously bailed out on the removed `while (true)` loop).
- Backend: added `opera-server-py/app/routes/_shared.py` (shared validation constants,
  `parse_json_body`, `sse_response`, a parameterized `require_string_list`, and a module
  logger) and refactored `generate.py`, `compose.py`, and `wechat_compose.py` onto it.
- Backend: replaced `print(...)` diagnostics with the standard `logging` module in the
  routes, `config.py`, and `main.py`.

### Verification
- `npm run lint` (opera-app): passed, 0 problems.
- `npm run build` (opera-app): passed (`tsc -b` + `vite build`).
- Backend contract + utils equivalents (29 checks mirroring `tests/test_api_contract.py`
  and `tests/test_utils.py`) via Starlette `TestClient`: all passed — identical SSE event
  sequences, 400 validation messages, all regenerate variants, and article preprocessing.
  (The local `pytest` install is missing `iniconfig`; an equivalent TestClient driver was
  used and then removed. Re-run `python -m pytest -q` once dev extras are installed.)
- Not run: `python scripts/test_e2e.py` (needs live provider credentials); Docker smoke test.

### Current Status
Frontend builds and lints clean; backend passes the full contract equivalent. Zero-change
frontend/backend compatibility preserved.

### Known Issues / Risks
- `.tmp-new-api/` (~26 MB, untracked) is an unrelated project clone left at the repo root;
  recommend relocating it outside the repository (already excluded from version control).
- Stale `tmp-*.log` files remain at the repo root (already git-ignored).

### Next Steps
- Optionally add retry/backoff to the shared SSE helper if proxied deployments need it.
- Relocate `.tmp-new-api/` and remove stale root logs in a hygiene pass.
