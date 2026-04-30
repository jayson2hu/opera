from app.config import Settings
from app.providers.anthropic_provider import AnthropicProvider
from app.providers.base import LLMProvider
from app.providers.openai_compat_provider import OpenAICompatProvider
from app.types import ProviderId


def _model_list(configured: str, *fallbacks: str) -> list[str]:
    seen: set[str] = set()
    models: list[str] = []
    candidates = configured.split(",") if configured else list(fallbacks)

    if configured:
        candidates.extend(fallbacks)

    for candidate in candidates:
        model = candidate.strip()
        if not model or model in seen:
            continue
        seen.add(model)
        models.append(model)

    return models


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

    if chosen == "anthropic_compat":
        if not settings.anthropic_compat_api_key:
            raise RuntimeError("ANTHROPIC_COMPAT_API_KEY is not configured")
        if not settings.anthropic_compat_base_url:
            raise RuntimeError("ANTHROPIC_COMPAT_BASE_URL is not configured")
        return AnthropicProvider(
            settings.anthropic_compat_api_key,
            settings.anthropic_compat_base_url,
            model_override or settings.anthropic_compat_model,
        )

    if chosen == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        return OpenAICompatProvider(
            settings.openai_api_key,
            settings.openai_base_url,
            model_override or settings.openai_model,
        )

    if chosen == "openai_compat":
        if not settings.openai_compat_api_key:
            raise RuntimeError("OPENAI_COMPAT_API_KEY is not configured")
        if not settings.openai_compat_base_url:
            raise RuntimeError("OPENAI_COMPAT_BASE_URL is not configured")
        return OpenAICompatProvider(
            settings.openai_compat_api_key,
            settings.openai_compat_base_url,
            model_override or settings.openai_compat_model,
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
    if not settings.custom_base_url:
        raise RuntimeError("CUSTOM_BASE_URL is not configured")
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
                "name": "Claude official",
                "models": _model_list(settings.anthropic_models, settings.anthropic_model),
            }
        )
    if settings.anthropic_compat_api_key and settings.anthropic_compat_base_url:
        available.append(
            {
                "id": "anthropic_compat",
                "name": "Claude third-party",
                "models": _model_list(settings.anthropic_compat_models, settings.anthropic_compat_model),
            }
        )
    if settings.openai_api_key:
        available.append(
            {
                "id": "openai",
                "name": "ChatGPT / OpenAI official",
                "models": _model_list(
                    settings.openai_models,
                    settings.openai_model,
                    settings.openai_chatgpt_model,
                ),
            }
        )
    if settings.openai_compat_api_key and settings.openai_compat_base_url:
        available.append(
            {
                "id": "openai_compat",
                "name": "ChatGPT / OpenAI third-party",
                "models": _model_list(settings.openai_compat_models, settings.openai_compat_model),
            }
        )
    if settings.deepseek_api_key:
        available.append(
            {
                "id": "deepseek",
                "name": "DeepSeek",
                "models": _model_list(settings.deepseek_models, settings.deepseek_model),
            }
        )
    if settings.custom_api_key and settings.custom_base_url:
        available.append(
            {
                "id": "custom",
                "name": "Custom (Legacy)",
                "models": _model_list(settings.custom_models, settings.custom_model),
            }
        )

    return {"default": settings.default_provider, "available": available}
