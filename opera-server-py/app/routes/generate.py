from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.card_protocol import read_cards_response
from app.config import VALID_PROVIDER_VALUES, get_settings
from app.prompts import (
    build_caption_prompt,
    build_cards_prompt,
    build_extraction_prompt,
    build_tags_prompt,
    build_titles_prompt,
)
from app.providers.factory import create_provider, get_available_providers, is_model_allowed
from app.routes._shared import (
    VALID_LENGTH_VALUES,
    VALID_LENGTHS,
    VALID_PROVIDERS,
    VALID_TONE_VALUES,
    VALID_TONES,
    OUTPUT_MAX_TOKENS,
    logger,
    parse_json_body,
    require_string_list,
    safe_stream_error,
    sse_response,
)
from app.sse import format_sse
from app.types import GenerateRequestModel, TagGroup
from app.providers.base import call_with_budget
from app.utils import extract_json, preprocess_article_text

router = APIRouter(prefix="/api")

MIN_COVER_TITLE_COUNT = 3
EXPECTED_COVER_TITLE_COUNT = 6
MIN_CARD_COUNT = 5
EXPECTED_CARD_COUNT = 7
MIN_EXTRACTION_POINT_COUNT = 3
MAX_EXTRACTION_POINT_COUNT = 8


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


    if not isinstance(tone, str) or tone not in VALID_TONES:
        return False, f"tone must be one of: {', '.join(VALID_TONE_VALUES)}", None

    if provider is not None and (
        not isinstance(provider, str) or provider not in VALID_PROVIDERS
    ):
        return False, f"provider must be one of: {', '.join(VALID_PROVIDER_VALUES)}", None

    if not isinstance(target_length, str) or target_length not in VALID_LENGTHS:
        return False, f"targetLength must be one of: {', '.join(VALID_LENGTH_VALUES)}", None

    if model is not None:
        if not isinstance(model, str):
            return False, "model must be a string", None
        model = model.strip()
        if not model:
            return False, "model must be a non-empty string", None

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


def read_string_list_response(parsed: Any, key: str, error_message: str) -> list[str]:
    if isinstance(parsed, list):
        values = require_string_list(parsed, error_message)
    elif isinstance(parsed, dict):
        values = require_string_list(parsed.get(key), error_message)
    else:
        raise RuntimeError(error_message)

    if len(values) < MIN_EXTRACTION_POINT_COUNT or len(values) > MAX_EXTRACTION_POINT_COUNT:
        raise RuntimeError(error_message)
    return values


def read_prompt_list_response(
    parsed: Any,
    key: str,
    error_message: str,
    *,
    minimum: int,
    maximum: int,
) -> list[str]:
    """Validate list fields against the counts promised by the generation prompt."""
    if not isinstance(parsed, dict):
        raise RuntimeError(error_message)
    values = require_string_list(parsed.get(key), error_message)
    if len(values) < minimum or len(values) > maximum:
        raise RuntimeError(error_message)
    return values


@router.get("/providers")
async def providers() -> dict[str, object]:
    return get_available_providers(get_settings())


@router.post("/generate")
async def generate(request: Request):
    body = await parse_json_body(request)

    valid, error, payload = validate_request(body)
    if not valid or payload is None:
        return JSONResponse(status_code=400, content={"error": error})

    settings = get_settings()
    if not is_model_allowed(settings, payload.provider, payload.model):
        return JSONResponse(
            status_code=400,
            content={"error": "model is not available for the selected provider"},
        )
    try:
        provider = create_provider(settings, payload.provider, payload.model)
    except Exception:
        logger.exception("Provider creation failed")
        return JSONResponse(
            status_code=400,
            content={"error": "Selected provider is not available"},
        )

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
            logger.exception("Generation error")
            yield format_sse(
                "error",
                {"error": safe_stream_error(exc, "Generation failed. Please try again.")},
            )

    return sse_response(event_stream())


@router.post("/generate/continue")
async def generate_continue(request: Request):
    body = await parse_json_body(request)

    valid, error, payload = validate_request(body)
    if not valid or payload is None:
        return JSONResponse(status_code=400, content={"error": error})
    if payload.points is None:
        return JSONResponse(status_code=400, content={"error": "points must contain 3-8 items"})

    settings = get_settings()
    if not is_model_allowed(settings, payload.provider, payload.model):
        return JSONResponse(
            status_code=400,
            content={"error": "model is not available for the selected provider"},
        )
    try:
        provider = create_provider(settings, payload.provider, payload.model)
    except Exception:
        logger.exception("Provider creation failed")
        return JSONResponse(
            status_code=400,
            content={"error": "Selected provider is not available"},
        )

    async def event_stream():
        try:
            async for event in generate_from_points(request, provider, payload, payload.points or []):
                yield event
        except Exception as exc:
            if await request.is_disconnected():
                return
            logger.exception("Generation error")
            yield format_sse(
                "error",
                {"error": safe_stream_error(exc, "Generation failed. Please try again.")},
            )

    return sse_response(event_stream())


async def generate_from_points(request: Request, provider: Any, payload: GenerateRequestModel, points: list[str]):
    yield format_sse("step", {"step": "titles"})
    titles_prompt = build_titles_prompt(payload.text, points, payload.tone)
    titles_raw = await provider.call(titles_prompt["system"], titles_prompt["user"])
    cover_titles = read_prompt_list_response(
        extract_json(titles_raw),
        "coverTitles",
        "Invalid titles response",
        minimum=MIN_COVER_TITLE_COUNT,
        maximum=EXPECTED_COVER_TITLE_COUNT,
    )
    if await request.is_disconnected():
        return
    yield format_sse("titles", {"coverTitles": cover_titles})

    yield format_sse("step", {"step": "cards"})
    cards_prompt = build_cards_prompt(payload.text, points, payload.tone)
    cards_raw = await provider.call(cards_prompt["system"], cards_prompt["user"])
    structured_cards = read_cards_response(
        extract_json(cards_raw),
        "Invalid cards response",
        minimum=MIN_CARD_COUNT,
        maximum=EXPECTED_CARD_COUNT,
    )
    cards = [card["content"] for card in structured_cards]
    if await request.is_disconnected():
        return
    # Keep the original string event for older clients and expose the typed event to new clients.
    yield format_sse("cards", {"cards": cards})
    yield format_sse("cards_v2", {"cards": structured_cards})

    yield format_sse("step", {"step": "caption"})
    caption_prompt = build_caption_prompt(payload.text, points, cards, payload.tone, payload.targetLength)
    caption_raw = await call_with_budget(
        provider,
        caption_prompt["system"],
        caption_prompt["user"],
        max_tokens=OUTPUT_MAX_TOKENS[payload.targetLength],
    )
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
