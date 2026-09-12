"""The acceptance runner must reject non-fixture targets before any POST."""

import copy
import sys

import httpx
import pytest

import http_acceptance as acceptance


@pytest.mark.parametrize("invalid_part", ["models", "default", "marker", "calls"])
def test_external_runner_fails_closed_before_generation(
    monkeypatch, tmp_path, capsys, invalid_part
):
    providers = {
        "default": "deepseek",
        "available": [
            {"id": provider, "models": sorted(acceptance.FIXTURE_MODELS)}
            for provider in ["deepseek", "anthropic", "openai"]
        ],
    }
    marker = copy.deepcopy(acceptance.FIXTURE_MARKER)
    calls = []
    if invalid_part == "models":
        providers["available"][0]["models"].append("REAL_MODEL_DO_NOT_DISPLAY")
    elif invalid_part == "default":
        providers["default"] = "REAL_PROVIDER_DO_NOT_DISPLAY"
    elif invalid_part == "marker":
        marker = {"fixture": "NOT_A_FIXTURE_DO_NOT_DISPLAY"}
    else:
        calls = {"secret": "DO_NOT_DISPLAY"}
    requests = []

    def respond(request):
        requests.append(request)
        assert request.method == "GET"
        payload = {
            "/api/health": {"status": "ok"},
            "/api/not-found": {"error": "Not found"},
            "/api/providers": providers,
            "/acceptance-fixture": marker,
            "/calls": calls,
        }[request.url.path]
        return httpx.Response(200, json=payload)

    client_type = httpx.Client
    monkeypatch.setattr(
        acceptance.httpx,
        "Client",
        lambda **kwargs: client_type(transport=httpx.MockTransport(respond), **kwargs),
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "http_acceptance.py",
            "--base-url",
            "https://backend.example",
            "--stub-url",
            "https://fixture.example",
            "--output-dir",
            str(tmp_path),
        ],
    )
    assert acceptance.main() == 1
    assert not any(request.method == "POST" for request in requests)
    output = capsys.readouterr()
    assert (
        output.err.strip()
        == "Acceptance fixture validation failed; no generation requests were sent."
    )
    assert "DO_NOT_DISPLAY" not in output.out + output.err
