import json
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import get_settings
from app.prompts_composer import (
    build_composer_body_prompt,
    build_composer_extraction_prompt,
    build_composer_tags_prompt,
    build_composer_title_prompt,
)
from app.providers.base import LLMProvider
from app.providers.factory import create_provider
from app.sse import format_sse
from app.types import (
    ComposeRequestModel,
    ComposerRegenerateTarget,
    ContentType,
    ProviderId,
    TargetLength,
    ToneType,
)
from app.utils import extract_json

router = APIRouter(prefix="/api")
VALID_TONE_VALUES: tuple[ToneType, ...] = ("knowledge", "casual", "bff")
VALID_PROVIDER_VALUES: tuple[ProviderId, ...] = ("anthropic", "deepseek", "custom")
VALID_CONTENT_TYPE_VALUES: tuple[ContentType, ...] = (
    "recommend",
    "knowledge",
    "story",
    "tutorial",
)
VALID_LENGTH_VALUES: tuple[TargetLength, ...] = ("short", "medium", "long")
VALID_REGENERATE_VALUES: tuple[ComposerRegenerateTarget, ...] = ("title", "body", "tags")
VALID_TONES: set[ToneType] = set(VALID_TONE_VALUES)
VALID_PROVIDERS: set[ProviderId] = set(VALID_PROVIDER_VALUES)
VALID_CONTENT_TYPES: set[ContentType] = set(VALID_CONTENT_TYPE_VALUES)
VALID_LENGTHS: set[TargetLength] = set(VALID_LENGTH_VALUES)
VALID_REGENERATES: set[ComposerRegenerateTarget] = set(VALID_REGENERATE_VALUES)


def validate_request(body: Any) -> tuple[bool, str | None, ComposeRequestModel | None]:
    if body is None or not isinstance(body, dict):
        return False, "Request body is required", None

    topic = body.get("topic")
    content_type = body.get("contentType")
    tone = body.get("tone")
    target_length = body.get("targetLength")
    provider = body.get("provider")
    model = body.get("model")
    regenerate = body.get("regenerate")

    if not isinstance(topic, str) or not topic.strip():
        return False, "topic is required and must be non-empty", None

    topic = topic.strip()
    if len(topic) < 10 or len(topic) > 500:
        return False, "topic must be 10-500 characters", None

    if content_type not in VALID_CONTENT_TYPES:
        return False, f"contentType must be one of: {', '.join(VALID_CONTENT_TYPE_VALUES)}", None

    if tone not in VALID_TONES:
        return False, f"tone must be one of: {', '.join(VALID_TONE_VALUES)}", None

    if target_length not in VALID_LENGTHS:
        return False, f"targetLength must be one of: {', '.join(VALID_LENGTH_VALUES)}", None

    if provider is not None and provider not in VALID_PROVIDERS:
        return False, f"provider must be one of: {', '.join(VALID_PROVIDER_VALUES)}", None

    if model is not None and not isinstance(model, str):
        return False, "model must be a string", None

    if regenerate is not None and regenerate not in VALID_REGENERATES:
        return False, f"regenerate must be one of: {', '.join(VALID_REGENERATE_VALUES)}", None

    return True, None, ComposeRequestModel(
        topic=topic,
        contentType=content_type,
        tone=tone,
        targetLength=target_length,
        provider=provider,
        model=model,
        regenerate=regenerate,
    )


def require_string_list(value: Any, error_message: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) and item.strip() for item in value):
        raise RuntimeError(error_message)
    return [item.strip() for item in value]


def require_structure(value: Any) -> dict[str, object]:
    if not isinstance(value, dict):
        raise RuntimeError("Invalid composer extraction response")

    outline = value.get("outline")
    must_mention = value.get("mustMention")
    required_string_fields = ("angle", "audience", "hook", "cta")

    if not all(isinstance(value.get(field), str) and str(value.get(field)).strip() for field in required_string_fields):
        raise RuntimeError("Invalid composer extraction response")

    if not isinstance(outline, list) or not all(isinstance(item, str) and item.strip() for item in outline):
        raise RuntimeError("Invalid composer extraction response")

    if not isinstance(must_mention, list) or not all(
        isinstance(item, str) and item.strip() for item in must_mention
    ):
        raise RuntimeError("Invalid composer extraction response")

    return value


async def collect_stream_text(provider: LLMProvider, system: str, user: str) -> str:
    chunks: list[str] = []
    async for chunk in provider.stream(system, user):
        if chunk:
            chunks.append(chunk)
    combined = "".join(chunks).strip()
    if not combined:
        raise RuntimeError("Invalid composer body response")
    return combined


@router.post("/compose")
async def compose(request: Request):
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

    async def generate_title(structure: dict[str, object]) -> str:
        title_prompt = build_composer_title_prompt(payload.topic, structure, payload.tone)
        title_raw = await provider.call(title_prompt["system"], title_prompt["user"])
        title = extract_json(title_raw).get("title")
        if not isinstance(title, str) or not title.strip():
            raise RuntimeError("Invalid composer title response")
        return title.strip()

    async def generate_tags(title: str, body_text: str) -> tuple[list[str], list[str]]:
        tags_prompt = build_composer_tags_prompt(payload.topic, title, body_text)
        tags_raw = await provider.call(tags_prompt["system"], tags_prompt["user"])
        parsed = extract_json(tags_raw)
        tags = require_string_list(parsed.get("tags"), "Invalid composer tags response")
        image_keywords = require_string_list(
            parsed.get("imageKeywords"),
            "Invalid composer image keywords response",
        )
        return tags, image_keywords

    async def event_stream():
        try:
            yield format_sse("step", {"step": "extracting"})
            extraction_prompt = build_composer_extraction_prompt(
                payload.topic,
                payload.contentType,
                payload.tone,
                payload.targetLength,
            )
            extraction_raw = await provider.call(
                extraction_prompt["system"], extraction_prompt["user"]
            )
            structure = require_structure(extract_json(extraction_raw))
            if await request.is_disconnected():
                return

            title = ""
            body_text = ""

            if payload.regenerate == "title":
                yield format_sse("step", {"step": "title"})
                title = await generate_title(structure)
                if await request.is_disconnected():
                    return
                yield format_sse("title", {"title": title})
                yield format_sse("step", {"step": "done"})
                return

            if payload.regenerate is None:
                yield format_sse("step", {"step": "title"})
                title = await generate_title(structure)
                if await request.is_disconnected():
                    return
                yield format_sse("title", {"title": title})

            if payload.regenerate == "body" or payload.regenerate is None:
                yield format_sse("step", {"step": "body"})
                body_prompt = build_composer_body_prompt(
                    payload.topic,
                    structure,
                    payload.tone,
                    payload.targetLength,
                    payload.contentType,
                )
                async for chunk in provider.stream(body_prompt["system"], body_prompt["user"]):
                    if await request.is_disconnected():
                        return
                    if not chunk:
                        continue
                    body_text += chunk
                    yield format_sse("body", {"body": body_text, "delta": chunk})

                if not body_text.strip():
                    raise RuntimeError("Invalid composer body response")

                if payload.regenerate == "body":
                    yield format_sse("step", {"step": "done"})
                    return

            if payload.regenerate == "tags":
                title = await generate_title(structure)
                body_prompt = build_composer_body_prompt(
                    payload.topic,
                    structure,
                    payload.tone,
                    payload.targetLength,
                    payload.contentType,
                )
                body_text = await collect_stream_text(
                    provider,
                    body_prompt["system"],
                    body_prompt["user"],
                )
                if await request.is_disconnected():
                    return

            yield format_sse("step", {"step": "tags"})
            if not title:
                title = await generate_title(structure)
            tags, image_keywords = await generate_tags(title, body_text.strip())
            if await request.is_disconnected():
                return
            yield format_sse("tags", {"tags": tags, "imageKeywords": image_keywords})
            yield format_sse("step", {"step": "done"})
        except Exception as exc:
            if await request.is_disconnected():
                return
            print(f"[opera-server-py] Composer error ({type(exc).__name__}): {exc!r}")
            yield format_sse("error", {"error": str(exc) or "Unknown error during compose"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
