"""Verify the Compose build contract for the frontend API base URL.

The Compose config contains backend provider credentials after env-file expansion, so
this check captures the JSON output and reports only the build argument under test.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
COMPOSE_FILE = REPOSITORY_ROOT / "docker-compose.yml"
CUSTOM_API_ORIGIN = "https://api.example.com"


def resolve_frontend_api_base(value: str | None) -> str:
    environment = os.environ.copy()
    environment["COMPOSE_DISABLE_ENV_FILE"] = "true"
    if value is None:
        environment.pop("VITE_API_BASE_URL", None)
    else:
        environment["VITE_API_BASE_URL"] = value

    completed = subprocess.run(
        [
            "docker",
            "compose",
            "--project-name",
            "opera-api-base-contract",
            "--file",
            str(COMPOSE_FILE),
            "config",
            "--format",
            "json",
        ],
        cwd=REPOSITORY_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or "docker compose config failed without stderr"
        raise RuntimeError(detail)

    config = json.loads(completed.stdout)
    return str(config["services"]["frontend"]["build"]["args"]["VITE_API_BASE_URL"])


def main() -> int:
    expectations = ((None, ""), (CUSTOM_API_ORIGIN, CUSTOM_API_ORIGIN))
    for configured, expected in expectations:
        actual = resolve_frontend_api_base(configured)
        if actual != expected:
            label = "unset" if configured is None else configured
            print(
                f"FAIL: VITE_API_BASE_URL={label!r} resolved to {actual!r}; "
                f"expected {expected!r}",
                file=sys.stderr,
            )
            return 1

    print("PASS: Compose API base interpolation (unset -> empty; custom -> exact value)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
