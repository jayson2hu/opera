# Isolated acceptance

These assets test the production React/Nginx/FastAPI path with a local model protocol
fixture. They do not call a paid model and are not part of the production image.
Use Docker Compose with `!reset` support and Buildx. This final Ubuntu run uses
temporary Compose 5.5.1 and Buildx 0.37.0 with Docker Engine 29.1.3 and Python 3.12;
the tools do not need to be installed globally.

## Container and HTTP checks

Run from the repository root. Install `opera-server-py/requirements-dev.lock` with
`pip install --require-hashes --only-binary=:all: -r` in a disposable Python 3.12
virtual environment, or use an existing interpreter with those exact dependencies.
Set `TEST_PYTHON` to that interpreter. Output belongs in a dedicated temporary directory.
The fixture override clears the backend env-file requirement, and the API-base
contract script uses the same approach; neither check requires real provider keys.
Use the development lock for the combined unit/safety tests, or `requirements.lock`
with the same hash/binary flags for HTTP-only checks. Keep the environment and
package cache outside the worktree and remove only the directories created for this run.

```bash
export COMPOSE_PROJECT_NAME="opera-acceptance-$(date +%s)-$$"
export OPERA_FRONTEND_PORT=18080 OPERA_BACKEND_PORT=13001 OPERA_FIXTURE_PORT=18081
ACCEPTANCE_OUTPUT=$(mktemp -d /tmp/opera-acceptance-results.XXXXXX)
compose=(docker compose -f docker-compose.yml -f tests/acceptance/compose.yml)

# A separate builder keeps test build caches out of the shared builder.
docker buildx create --name "$COMPOSE_PROJECT_NAME" --driver docker-container --bootstrap
cleanup() {
  "${compose[@]}" down --volumes --rmi all
  docker buildx rm "$COMPOSE_PROJECT_NAME"
}
trap cleanup EXIT

"${compose[@]}" build --builder "$COMPOSE_PROJECT_NAME"
"${compose[@]}" up --no-build --detach --wait --wait-timeout 120
"${TEST_PYTHON:?Set TEST_PYTHON to a disposable test interpreter}" tests/acceptance/http_acceptance.py \
  --base-url http://127.0.0.1:13001 --stub-url http://127.0.0.1:18081 \
  --output-dir "$ACCEPTANCE_OUTPUT/backend"
"$TEST_PYTHON" tests/acceptance/http_acceptance.py \
  --base-url http://127.0.0.1:18080 --stub-url http://127.0.0.1:18081 --through-proxy \
  --output-dir "$ACCEPTANCE_OUTPUT/nginx"
```

Run the snippet in a dedicated shell/script so its `EXIT` trap runs when the check
finishes. Inspect/copy required reports, then remove the exact temporary output and
virtual-environment directories you created. If the BuildKit image was newly pulled
for this test and no other builder uses it, remove that specific image too. Do not use
`docker system prune`, global cache clearing, or delete pre-existing environments.

The standalone BuildKit container does not automatically inherit the Docker daemon's
registry mirrors. If the daemon can pull images but the builder cannot, supply a
temporary `--buildkitd-config` matching the daemon's already approved mirrors when
creating the test builder. Keep that configuration outside the repository.

`http_acceptance.py` covers healthy/unavailable requests, malformed input, both model
protocols, all three flows, extraction pause/continue, six partial-generation targets,
model allowlists, truncated streams, upstream errors, and actual incremental delivery.
Nginx consumes `X-Accel-Buffering`; `--through-proxy` allows that missing header but still
checks the arrival time of individual body events. The fixture accepts only synthetic
test requests; do not configure it as a real provider or put user drafts into it.

## Browser checks

The browser runner and its instructions are kept alongside this file. Use a disposable
Playwright install, browser-download directory and browser contexts. Store screenshots,
downloads and JSON results under the temporary output directory, not in the worktree.
Browser protocol mocks verify interaction and failure handling; the additional Docker
journeys verify actual browser → Nginx → FastAPI → protocol-fixture wiring.

With the application or Compose stack already running, install the runner separately
from the repository (verified with Node 22 and Playwright 1.63.0):

```bash
BROWSER_ACCEPTANCE_DIR=$(mktemp -d /tmp/opera-browser.XXXXXX)
export PLAYWRIGHT_BROWSERS_PATH="$BROWSER_ACCEPTANCE_DIR/browsers"
npm install --no-save --prefix "$BROWSER_ACCEPTANCE_DIR/tools" \
  --cache "$BROWSER_ACCEPTANCE_DIR/npm-cache" @playwright/test@1.63.0
"$BROWSER_ACCEPTANCE_DIR/tools/node_modules/.bin/playwright" install chromium --only-shell

node tests/acceptance/browser-acceptance.mjs \
  --url http://127.0.0.1:18080 --mode mock \
  --dependency-dir "$BROWSER_ACCEPTANCE_DIR/tools" \
  --runtime-dir "$BROWSER_ACCEPTANCE_DIR" \
  --output-dir "$BROWSER_ACCEPTANCE_DIR/mock-results"

# Run after the HTTP acceptance runner finishes; both share the protocol fixture.
node tests/acceptance/browser-acceptance.mjs \
  --url http://127.0.0.1:18080 --mode integration \
  --dependency-dir "$BROWSER_ACCEPTANCE_DIR/tools" \
  --runtime-dir "$BROWSER_ACCEPTANCE_DIR" \
  --output-dir "$BROWSER_ACCEPTANCE_DIR/integration-results"
```

`--filter REGEXP` selects cases for focused retests. `--browser-executable PATH`
uses an existing Chromium executable. Keep the runtime path short: Chromium's Unix
socket paths require `--runtime-dir` to be at most 58 bytes. Results include JSON,
screenshots and downloaded draft/image files; a failing case sets a nonzero exit code.
Invalid filters fail before browser startup; filters matching no cases also fail and
write an empty result list instead of reporting a successful acceptance run.
Inspect/copy the reports, then remove the exact `$BROWSER_ACCEPTANCE_DIR` created
above. No global npm installation, repository `node_modules`, or browser profile is
needed. The runner closes its contexts and browser before exiting normally.

Mock mode checks the built UI against controlled API responses, including draft
recovery, independent drafts, paragraph/full-generation candidates, cancellation,
conflicts, quota failures, confirmed deletion, version restore, clipboard/downloads,
theme/layout and conversion between flows. Integration mode refuses non-local URLs
or providers other than the three fixture providers with exactly
`stub-model,stub-truncated,stub-error`, explicitly selects `openai/stub-model`, and
blocks unexpected generation requests. It must not be pointed at a paid provider.

Chromium viewport and composition-event tests are not native Safari/iOS or a physical
Chinese input-method session. Real-provider content quality and paid-call acceptance
require a separately configured provider.

## CI evidence

The Docker CI job runs both HTTP suites, the Chromium interaction matrix and the
three browser-to-container journeys. It retains generated HTTP/browser reports and
screenshots as an artifact named for the commit SHA for 14 days, even on failure.
Local rechecks retain a compact result and source fingerprint in `docs/acceptance/`;
temporary images, browser profiles, caches and sample downloads can then be removed.
