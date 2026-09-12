"""Verify the Compose build contract for the frontend API base URL.

Service env files are not needed for this deployment contract. Leave them unresolved
so the check works without credentials and never reads a project's provider keys.
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


def resolve_compose_config(value: str | None, bindings: dict[str, str] | None = None) -> dict:
    environment = os.environ.copy()
    environment["COMPOSE_DISABLE_ENV_FILE"] = "true"
    for variable in ("OPERA_BIND_ADDRESS", "OPERA_BACKEND_PORT", "OPERA_FRONTEND_PORT"):
        environment.pop(variable, None)
    environment.update(bindings or {})
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
            "--file",
            "-",
            "config",
            "--no-env-resolution",
            "--format",
            "json",
        ],
        cwd=REPOSITORY_ROOT,
        env=environment,
        input="services:\n  backend:\n    env_file: !reset []\n",
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or "docker compose config failed without stderr"
        raise RuntimeError(detail)

    return json.loads(completed.stdout)


def main() -> int:
    expectations = ((None, ""), (CUSTOM_API_ORIGIN, CUSTOM_API_ORIGIN))
    for configured, expected in expectations:
        config = resolve_compose_config(configured)
        actual = str(config["services"]["frontend"]["build"]["args"]["VITE_API_BASE_URL"])
        if actual != expected:
            label = "unset" if configured is None else configured
            print(
                f"FAIL: VITE_API_BASE_URL={label!r} resolved to {actual!r}; "
                f"expected {expected!r}",
                file=sys.stderr,
            )
            return 1

    for variables, host, backend_port, frontend_port in (
        ({}, "127.0.0.1", "3001", "8080"),
        ({"OPERA_BIND_ADDRESS": "127.0.0.2", "OPERA_BACKEND_PORT": "13001",
          "OPERA_FRONTEND_PORT": "18080"}, "127.0.0.2", "13001", "18080"),
    ):
        services = resolve_compose_config(None, variables)["services"]
        for name, port in (("backend", backend_port), ("frontend", frontend_port)):
            service = services[name]
            published = service["ports"]
            if "container_name" in service or len(published) != 1 or (
                published[0].get("host_ip") != host or str(published[0]["published"]) != port
            ):
                print(f"FAIL: {name} must support isolated names and explicit loopback ports", file=sys.stderr)
                return 1

    print("PASS: Compose API base interpolation, loopback defaults, port overrides, and project isolation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
