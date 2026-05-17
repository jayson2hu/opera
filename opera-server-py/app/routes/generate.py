import json
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import VALID_PROVIDER_VALUES, get_settings
from app.prompts import (
    build_caption_prompt,
    build_cards_prompt,
    build_extraction_prompt,
    build_tags_prompt,
    build_titles_prompt,
)
from app.providers.factory import create_provider, get_available_providers
from app.sse import format_sse
from app.types import GenerateRequestModel, ProviderId, TagGroup, TargetLength, ToneType
from app.utils import extract_json, preprocess_article_text

router = APIRouter(prefix="/api")
VALID_TONE_VALUES: tuple[ToneType, ...] = ("knowledge", "casual", "bff")
VALID_LENGTH_VALUES: tuple[TargetLength, ...] = ("short", "medium", "long")
VALID_TONES: set[ToneType] = set(VALID_TONE_VALUES)
VALID_PROVIDERS: set[ProviderId] = set(VALID_PROVIDER_VALUES)
VALID_LENGTHS: set[TargetLength] = set(VALID_LENGTH_VALUES)



def validate_request(body: Any) -> tuple[bool, str | None, GenerateRequestModel | None]:
    settings = get_settings()

    if body is None or not isinstance(body, dict):
        return False, "Request body is required", None

    text = body.get("text")
    tone = body.get("tone")
    target_length = body.get("targetLength", "medium")
    provider = body.get("provider")
    model = body.get("model")
    points = body.get("points")

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

    if target_length not in VALID_LENGTHS:
        return False, f"targetLength must be one of: {', '.join(VALID_LENGTH_VALUES)}", None

    if model is not None and not isinstance(model, str):
        return False, "model must be a string", None

    if points is not None:
        if not isinstance(points, list) or not all(isinstance(point, str) for point in points):
            return False, "points must be an array of strings", None
        cleaned_points = [point.strip() for point in points if point.strip()]
        if len(cleaned_points) < 3 or len(cleaned_points) > 8:
            return False, "points must contain 3-8 items", None
    else:
        cleaned_points = None

    return True, None, GenerateRequestModel(
        text=cleaned_text,
        tone=tone,
        targetLength=target_length,
        provider=provider,
        model=model,
        points=cleaned_points,
    )


def require_string_list(value: Any, error_message: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise RuntimeError(error_message)
    return value


def read_string_list_response(parsed: Any, key: str, error_message: str) -> list[str]:
    if isinstance(parsed, list):
        return require_string_list(parsed, error_message)
    if isinstance(parsed, dict):
        return require_string_list(parsed.get(key), error_message)
    raise RuntimeError(error_message)


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
            points = read_string_list_response(
                extract_json(extraction_raw),
                "points",
                "Invalid extraction response",
            )
            if await request.is_disconnected():
                return

            if payload.points is None:
                yield format_sse("extraction_points", {"points": points})
                yield format_sse("step", {"step": "paused"})
                return

            async for event in generate_from_points(request, provider, payload, payload.points):
                yield event
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


@router.post("/generate/continue")
async def generate_continue(request: Request):
    try:
        body = await request.json()
    except json.JSONDecodeError:
        body = None

    valid, error, payload = validate_request(body)
    if not valid or payload is None:
        return JSONResponse(status_code=400, content={"error": error})
    if payload.points is None:
        return JSONResponse(status_code=400, content={"error": "points must contain 3-8 items"})

    settings = get_settings()
    try:
        provider = create_provider(settings, payload.provider, payload.model)
    except Exception as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})

    async def event_stream():
        try:
            async for event in generate_from_points(request, provider, payload, payload.points or []):
                yield event
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


async def generate_from_points(request: Request, provider: Any, payload: GenerateRequestModel, points: list[str]):
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
    caption_prompt = build_caption_prompt(payload.text, points, cards, payload.tone, payload.targetLength)
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
