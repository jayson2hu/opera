import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("AI_PROVIDER", "deepseek")
os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")

from app.config import DEFAULT_CORS_ORIGINS, Settings, get_settings, validate_config
from app.main import create_app


def test_cors_origins_default_to_local_frontend_origins() -> None:
    settings = Settings(_env_file=None)

    assert settings.cors_origins == list(DEFAULT_CORS_ORIGINS)


def test_cors_origins_parse_normalize_and_deduplicate_exact_origins() -> None:
    settings = Settings(
        _env_file=None,
        cors_origins_value=(
            " https://Studio.Example.com,https://admin.example.com/,"
            "https://studio.example.com "
        ),
    )

    assert settings.cors_origins == [
        "https://studio.example.com",
        "https://admin.example.com",
    ]


@pytest.mark.parametrize(
    "cors_origins_value",
    [
        "",
        "   ,  ",
        "*",
        "https://*.example.com",
        "ftp://app.example.com",
        "https://user:secret@app.example.com",
        "https://app.example.com/dashboard",
        "https://app.example.com?tenant=one",
        "https://app.example.com#fragment",
        "https://app.example.com:not-a-port",
    ],
)
def test_validate_config_rejects_non_exact_cors_origins(
    cors_origins_value: str,
) -> None:
    settings = Settings(
        _env_file=None,
        ai_provider="deepseek",
        deepseek_api_key="test-key",
        cors_origins_value=cors_origins_value,
    )

    with pytest.raises(RuntimeError, match="CORS_ORIGINS must be a comma-separated list"):
        validate_config(settings)


def test_create_app_applies_configured_cors_allowlist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://studio.example.com,https://admin.example.com",
    )
    get_settings.cache_clear()

    try:
        with TestClient(create_app()) as client:
            allowed = client.options(
                "/api/health",
                headers={
                    "Origin": "https://studio.example.com",
                    "Access-Control-Request-Method": "GET",
                },
            )
            denied = client.options(
                "/api/health",
                headers={
                    "Origin": "https://attacker.example.com",
                    "Access-Control-Request-Method": "GET",
                },
            )
    finally:
        get_settings.cache_clear()

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "https://studio.example.com"
    assert "access-control-allow-origin" not in denied.headers
