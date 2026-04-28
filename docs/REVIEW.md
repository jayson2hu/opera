# Review Notes

Review date: 2026-04-27

## Scope

Reviewed project layout, documentation, startup scripts, deployment configuration, frontend package scripts, FastAPI backend routes, and current repository hygiene.

## Findings

1. Frontend build currently fails in local validation.
   `npm.cmd run build` reaches Vite config loading, then fails while loading `@tailwindcss/oxide-win32-x64-msvc` and reports `stream did not contain valid UTF-8` plus `spawn EPERM`. This points to a local native dependency or Windows permission issue rather than a TypeScript compile failure.

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
- `npm.cmd run lint` in `opera-app/`: passed.
- `docker compose config`: passed, with warnings that Docker config under the user profile could not be read.

Failed:

- `npm.cmd run build` in `opera-app/`: failed while loading the Vite config because Tailwind's Windows native dependency could not be loaded and a child process hit `EPERM`.

## Recommended Follow-Up

- Refresh frontend dependencies on a clean shell, then rerun `npm.cmd run build`.
- Add CI so frontend build, lint, backend tests, and `docker compose config` run on pull requests.
- Consider moving generated temp logs out of the working tree entirely; current `.gitignore` covers common log patterns, but the root has existing temporary artifacts locally.
