import logging
from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("opera-server-py")

ProviderId = Literal["anthropic", "anthropic_compat", "openai", "openai_compat", "deepseek", "custom"]
VALID_PROVIDER_VALUES: tuple[ProviderId, ...] = (
    "anthropic",
    "anthropic_compat",
    "openai",
    "openai_compat",
    "deepseek",
    "custom",
)
VALID_PROVIDERS: set[ProviderId] = set(VALID_PROVIDER_VALUES)
DEFAULT_CORS_ORIGINS: tuple[str, ...] = (
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
)
DEFAULT_CORS_ORIGINS_VALUE = ",".join(DEFAULT_CORS_ORIGINS)


def parse_provider(value: str | None) -> ProviderId:
    normalized = (value or "anthropic").lower()
    if normalized not in VALID_PROVIDERS:
        logger.warning('Unknown AI_PROVIDER "%s", falling back to "anthropic"', value)
        return "anthropic"
    return normalized  # type: ignore[return-value]


def parse_cors_origins(value: str) -> list[str]:
    """Parse exact HTTP(S) origins from a comma-separated setting."""
    origins: list[str] = []
    for raw_origin in value.split(","):
        origin = raw_origin.strip()
        if not origin:
            continue
        if "*" in origin or any(character.isspace() for character in origin):
            raise ValueError("CORS origins must not contain wildcards or whitespace")

        parsed = urlsplit(origin)
        try:
            parsed.port
        except ValueError as exc:
            raise ValueError("CORS origin has an invalid port") from exc

        if parsed.scheme.lower() not in {"http", "https"}:
            raise ValueError("CORS origin must use http or https")
        if not parsed.hostname or parsed.username is not None or parsed.password is not None:
            raise ValueError("CORS origin must contain only a host and optional port")
        if parsed.netloc.endswith(":"):
            raise ValueError("CORS origin has an invalid port")
        if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
            raise ValueError("CORS origin must not contain a path, query, or fragment")

        normalized = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
        if normalized not in origins:
            origins.append(normalized)

    if not origins:
        raise ValueError("At least one CORS origin is required")
    return origins


class Settings(BaseSettings):
    port: int = 3001
    cors_origins_value: str = Field(
        default=DEFAULT_CORS_ORIGINS_VALUE,
        validation_alias="CORS_ORIGINS",
    )
    ai_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-sonnet-4-20250514"
    anthropic_models: str = ""
    anthropic_compat_api_key: str = ""
    anthropic_compat_base_url: str = ""
    anthropic_compat_model: str = ""
    anthropic_compat_models: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com"
    openai_model: str = "gpt-5.2"
    openai_chatgpt_model: str = "gpt-5.2-chat-latest"
    openai_models: str = ""
    openai_compat_api_key: str = ""
    openai_compat_base_url: str = ""
    openai_compat_model: str = ""
    openai_compat_models: str = ""
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    deepseek_models: str = ""
    custom_api_key: str = ""
    custom_base_url: str = ""
    custom_model: str = ""
    custom_models: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def default_provider(self) -> ProviderId:
        return parse_provider(self.ai_provider)

    @property
    def max_input_length(self) -> int:
        return 50_000

    @property
    def cors_origins(self) -> list[str]:
        return parse_cors_origins(self.cors_origins_value)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def validate_config(settings: Settings) -> None:
    try:
        settings.cors_origins
    except ValueError as exc:
        raise RuntimeError(
            "[opera-server-py] CORS_ORIGINS must be a comma-separated list of exact "
            "http(s) origins without wildcards, paths, query strings, or fragments."
        ) from exc

    provider = settings.default_provider
    key_map = {
        "anthropic": settings.anthropic_api_key,
        "anthropic_compat": settings.anthropic_compat_api_key,
        "openai": settings.openai_api_key,
        "openai_compat": settings.openai_compat_api_key,
        "deepseek": settings.deepseek_api_key,
        "custom": settings.custom_api_key,
    }

    if not key_map[provider]:
        raise RuntimeError(
            f'[opera-server-py] Default provider is "{provider}" but its API key is not set. '
            'Copy .env.example to .env and configure the relevant key.'
        )

    if provider == "anthropic_compat" and not settings.anthropic_compat_base_url:
        raise RuntimeError(
            "[opera-server-py] ANTHROPIC_COMPAT_BASE_URL is required when AI_PROVIDER=anthropic_compat."
        )

    if provider == "openai_compat" and not settings.openai_compat_base_url:
        raise RuntimeError(
            "[opera-server-py] OPENAI_COMPAT_BASE_URL is required when AI_PROVIDER=openai_compat."
        )

    if provider == "custom" and not settings.custom_base_url:
        raise RuntimeError(
            "[opera-server-py] CUSTOM_BASE_URL is required when AI_PROVIDER=custom."
        )
