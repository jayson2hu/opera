from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderId = Literal["anthropic", "deepseek", "custom"]
VALID_PROVIDERS: set[ProviderId] = {"anthropic", "deepseek", "custom"}


def parse_provider(value: str | None) -> ProviderId:
    normalized = (value or "anthropic").lower()
    if normalized not in VALID_PROVIDERS:
        print(f'[opera-server-py] Unknown AI_PROVIDER "{value}", falling back to "anthropic"')
        return "anthropic"
    return normalized  # type: ignore[return-value]


class Settings(BaseSettings):
    port: int = 3001
    ai_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-sonnet-4-20250514"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    custom_api_key: str = ""
    custom_base_url: str = ""
    custom_model: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def default_provider(self) -> ProviderId:
        return parse_provider(self.ai_provider)

    @property
    def max_input_length(self) -> int:
        return 50_000

    @property
    def cors_origins(self) -> list[str]:
        return [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def validate_config(settings: Settings) -> None:
    provider = settings.default_provider
    key_map = {
        "anthropic": settings.anthropic_api_key,
        "deepseek": settings.deepseek_api_key,
        "custom": settings.custom_api_key,
    }

    if not key_map[provider]:
        raise RuntimeError(
            f'[opera-server-py] Default provider is "{provider}" but its API key is not set. '
            'Copy .env.example to .env and configure the relevant key.'
        )

    if provider == "custom" and not settings.custom_base_url:
        raise RuntimeError(
            "[opera-server-py] CUSTOM_BASE_URL is required when AI_PROVIDER=custom."
        )
