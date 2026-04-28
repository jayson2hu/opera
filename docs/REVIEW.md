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
- `npm.cmd run lint` in `opera-app/`: passed.
- `npm.cmd run build` in `opera-app/`: passed when run outside the restricted sandbox.
- `docker compose config`: passed previously, with warnings that Docker config under the user profile could not be read.

## Recommended Follow-Up

- Run full Docker startup smoke test with `docker compose up --build` when Docker Engine validation is approved.
- Run live provider E2E with `python scripts/test_e2e.py` when real API usage is approved.
- Consider moving generated temp logs out of the working tree entirely; current `.gitignore` covers common log patterns, but the root has existing temporary artifacts locally.
