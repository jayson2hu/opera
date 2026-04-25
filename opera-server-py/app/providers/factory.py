from app.config import Settings
from app.providers.anthropic_provider import AnthropicProvider
from app.providers.base import LLMProvider
from app.providers.openai_compat_provider import OpenAICompatProvider
from app.types import ProviderId


def create_provider(
    settings: Settings,
    provider_id: ProviderId | None = None,
    model_override: str | None = None,
) -> LLMProvider:
    chosen = provider_id or settings.default_provider

    if chosen == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not configured")
        return AnthropicProvider(
            settings.anthropic_api_key,
            settings.anthropic_base_url,
            model_override or settings.anthropic_model,
        )

    if chosen == "deepseek":
        if not settings.deepseek_api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
        return OpenAICompatProvider(
            settings.deepseek_api_key,
            settings.deepseek_base_url,
            model_override or settings.deepseek_model,
        )

    if not settings.custom_api_key:
        raise RuntimeError("CUSTOM_API_KEY is not configured")
    return OpenAICompatProvider(
        settings.custom_api_key,
        settings.custom_base_url,
        model_override or settings.custom_model,
    )


def get_available_providers(settings: Settings) -> dict[str, object]:
    available: list[dict[str, object]] = []

    if settings.anthropic_api_key:
        available.append(
            {
                "id": "anthropic",
                "name": "Claude",
                "models": [settings.anthropic_model],
            }
        )
    if settings.deepseek_api_key:
        available.append(
            {
                "id": "deepseek",
                "name": "DeepSeek",
                "models": [settings.deepseek_model],
            }
        )
    if settings.custom_api_key:
        available.append(
            {
                "id": "custom",
                "name": "自定义",
                "models": [settings.custom_model],
            }
        )

    return {"default": settings.default_provider, "available": available}
