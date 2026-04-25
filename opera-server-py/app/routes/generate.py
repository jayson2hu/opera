import json
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import get_settings
from app.prompts import (
    build_caption_prompt,
    build_cards_prompt,
    build_extraction_prompt,
    build_tags_prompt,
    build_titles_prompt,
)
from app.providers.factory import create_provider, get_available_providers
from app.sse import format_sse
from app.types import GenerateRequestModel, ProviderId, TagGroup, ToneType
from app.utils import extract_json, preprocess_article_text

router = APIRouter(prefix="/api")
VALID_TONE_VALUES: tuple[ToneType, ...] = ("knowledge", "casual", "bff")
VALID_PROVIDER_VALUES: tuple[ProviderId, ...] = ("anthropic", "deepseek", "custom")
VALID_TONES: set[ToneType] = set(VALID_TONE_VALUES)
VALID_PROVIDERS: set[ProviderId] = set(VALID_PROVIDER_VALUES)



def validate_request(body: Any) -> tuple[bool, str | None, GenerateRequestModel | None]:
    settings = get_settings()

    if body is None or not isinstance(body, dict):
        return False, "Request body is required", None

    text = body.get("text")
    tone = body.get("tone")
    provider = body.get("provider")
    model = body.get("model")

    if not isinstance(text, str) or not text.strip():
        return False, "text is required and must be non-empty", None

    cleaned_text = preprocess_article_text(text)
    if not cleaned_text:
        return False, "text is required and must be non-empty", None

    if len(cleaned_text) > settings.max_input_length:
        return False, f"text exceeds maximum length of {settings.max_input_length} characters", None


    if tone not in VALID_TONES:
        return False, f"tone must be one of: {', '.join(VALID_TONE_VALUES)}", None

    if provider is not None and provider not in VALID_PROVIDERS:
        return False, f"provider must be one of: {', '.join(VALID_PROVIDER_VALUES)}", None


    if model is not None and not isinstance(model, str):
        return False, "model must be a string", None

    return True, None, GenerateRequestModel(
        text=cleaned_text,
        tone=tone,
        provider=provider,
        model=model,
    )


def require_string_list(value: Any, error_message: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise RuntimeError(error_message)
    return value


@router.get("/providers")
async def providers() -> dict[str, object]:
    return get_available_providers(get_settings())


@router.post("/generate")
async def generate(request: Request):
    try:
        body = await request.json()
    except json.JSONDecodeError:
        body = None

    valid, error, payload = validate_request(body)
    if not valid or payload is None:
        return JSONResponse(status_code=400, content={"error": error})

    settings = get_settings()
    try:
        provider = create_provider(settings, payload.provider, payload.model)
    except Exception as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})

    async def event_stream():
        try:
            yield format_sse("step", {"step": "extracting"})
            extraction_prompt = build_extraction_prompt(payload.text, payload.tone)
            extraction_raw = await provider.call(
                extraction_prompt["system"], extraction_prompt["user"]
            )
            points = require_string_list(
                extract_json(extraction_raw).get("points"),
                "Invalid extraction response",
            )
            if await request.is_disconnected():
                return

            yield format_sse("step", {"step": "titles"})
            titles_prompt = build_titles_prompt(payload.text, points, payload.tone)
            titles_raw = await provider.call(titles_prompt["system"], titles_prompt["user"])
            cover_titles = require_string_list(
                extract_json(titles_raw).get("coverTitles"),
                "Invalid titles response",
            )
            if await request.is_disconnected():
                return
            yield format_sse("titles", {"coverTitles": cover_titles})

            yield format_sse("step", {"step": "cards"})
            cards_prompt = build_cards_prompt(payload.text, points, payload.tone)
            cards_raw = await provider.call(cards_prompt["system"], cards_prompt["user"])
            cards = require_string_list(
                extract_json(cards_raw).get("cards"),
                "Invalid cards response",
            )
            if await request.is_disconnected():
                return
            yield format_sse("cards", {"cards": cards})

            yield format_sse("step", {"step": "caption"})
            caption_prompt = build_caption_prompt(payload.text, points, cards, payload.tone)
            caption_raw = await provider.call(caption_prompt["system"], caption_prompt["user"])
            caption = extract_json(caption_raw).get("caption")
            if not isinstance(caption, str) or not caption:
                raise RuntimeError("Invalid caption response")
            if await request.is_disconnected():
                return
            yield format_sse("caption", {"caption": caption})

            yield format_sse("step", {"step": "tags"})
            tags_prompt = build_tags_prompt(payload.text, points, payload.tone)
            tags_raw = await provider.call(tags_prompt["system"], tags_prompt["user"])
            raw_groups = extract_json(tags_raw).get("tagGroups")
            if not isinstance(raw_groups, list):
                raise RuntimeError("Invalid tags response")
            tag_groups = [TagGroup.model_validate(group).model_dump() for group in raw_groups]
            if await request.is_disconnected():
                return
            yield format_sse("tags", {"tagGroups": tag_groups})
            yield format_sse("step", {"step": "done"})
        except Exception as exc:
            if await request.is_disconnected():
                return
            print(f"[opera-server-py] Generation error ({type(exc).__name__}): {exc!r}")
            yield format_sse("error", {"error": str(exc) or "Unknown error during generation"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
