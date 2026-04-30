import json
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import VALID_PROVIDER_VALUES, get_settings
from app.prompts_wechat import (
    build_wechat_body_prompt,
    build_wechat_digest_prompt,
    build_wechat_extraction_prompt,
    build_wechat_title_prompt,
)
from app.providers.factory import create_provider
from app.sse import format_sse
from app.types import (
    ProviderId,
    TargetLength,
    ToneType,
    WeChatArticleType,
    WeChatComposeRequestModel,
    WeChatRegenerateTarget,
)
from app.utils import extract_json

router = APIRouter(prefix="/api")
VALID_TONE_VALUES: tuple[ToneType, ...] = ("knowledge", "casual", "bff")
VALID_ARTICLE_TYPE_VALUES: tuple[WeChatArticleType, ...] = (
    "insight",
    "guide",
    "story",
    "briefing",
)
VALID_LENGTH_VALUES: tuple[TargetLength, ...] = ("short", "medium", "long")
VALID_REGENERATE_VALUES: tuple[WeChatRegenerateTarget, ...] = ("title", "digest", "body")
VALID_TONES: set[ToneType] = set(VALID_TONE_VALUES)
VALID_PROVIDERS: set[ProviderId] = set(VALID_PROVIDER_VALUES)
VALID_ARTICLE_TYPES: set[WeChatArticleType] = set(VALID_ARTICLE_TYPE_VALUES)
VALID_LENGTHS: set[TargetLength] = set(VALID_LENGTH_VALUES)
VALID_REGENERATES: set[WeChatRegenerateTarget] = set(VALID_REGENERATE_VALUES)


def validate_request(body: Any) -> tuple[bool, str | None, WeChatComposeRequestModel | None]:
    if body is None or not isinstance(body, dict):
        return False, "Request body is required", None

    topic = body.get("topic")
    article_type = body.get("articleType")
    tone = body.get("tone")
    target_length = body.get("targetLength")
    provider = body.get("provider")
    model = body.get("model")
    regenerate = body.get("regenerate")

    if not isinstance(topic, str) or not topic.strip():
        return False, "topic is required and must be non-empty", None

    topic = topic.strip()
    if len(topic) < 12 or len(topic) > 500:
        return False, "topic must be 12-500 characters", None

    if article_type not in VALID_ARTICLE_TYPES:
        return False, f"articleType must be one of: {', '.join(VALID_ARTICLE_TYPE_VALUES)}", None

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

    return True, None, WeChatComposeRequestModel(
        topic=topic,
        articleType=article_type,
        tone=tone,
        targetLength=target_length,
        provider=provider,
        model=model,
        regenerate=regenerate,
    )


def require_structure(value: Any) -> dict[str, object]:
    if not isinstance(value, dict):
        raise RuntimeError("Invalid wechat extraction response")

    outline = value.get("outline")
    key_points = value.get("keyPoints")
    required_string_fields = ("angle", "audience", "promise", "cta")

    if not all(isinstance(value.get(field), str) and str(value.get(field)).strip() for field in required_string_fields):
        raise RuntimeError("Invalid wechat extraction response")

    if not isinstance(outline, list) or not all(isinstance(item, str) and item.strip() for item in outline):
        raise RuntimeError("Invalid wechat extraction response")

    if not isinstance(key_points, list) or not all(isinstance(item, str) and item.strip() for item in key_points):
        raise RuntimeError("Invalid wechat extraction response")

    return value


@router.post("/wechat/compose")
async def compose_wechat(request: Request):
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
        title_prompt = build_wechat_title_prompt(payload.topic, structure)
        title_raw = await provider.call(title_prompt["system"], title_prompt["user"])
        title = extract_json(title_raw).get("title")
        if not isinstance(title, str) or not title.strip():
            raise RuntimeError("Invalid wechat title response")
        return title.strip()

    async def generate_digest(structure: dict[str, object], title: str | None = None) -> str:
        digest_prompt = build_wechat_digest_prompt(payload.topic, structure, title)
        digest_raw = await provider.call(digest_prompt["system"], digest_prompt["user"])
        digest = extract_json(digest_raw).get("digest")
        if not isinstance(digest, str) or not digest.strip():
            raise RuntimeError("Invalid wechat digest response")
        return digest.strip()

    async def event_stream():
        try:
            yield format_sse("step", {"step": "extracting"})
            extraction_prompt = build_wechat_extraction_prompt(
                payload.topic,
                payload.articleType,
                payload.tone,
                payload.targetLength,
            )
            extraction_raw = await provider.call(extraction_prompt["system"], extraction_prompt["user"])
            structure = require_structure(extract_json(extraction_raw))
            if await request.is_disconnected():
                return

            title = ""
            digest = ""
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

            if payload.regenerate == "digest":
                yield format_sse("step", {"step": "digest"})
                digest = await generate_digest(structure)
                if await request.is_disconnected():
                    return
                yield format_sse("digest", {"digest": digest})
                yield format_sse("step", {"step": "done"})
                return

            if payload.regenerate is None:
                yield format_sse("step", {"step": "digest"})
                digest = await generate_digest(structure, title)
                if await request.is_disconnected():
                    return
                yield format_sse("digest", {"digest": digest})

            yield format_sse("step", {"step": "body"})
            body_prompt = build_wechat_body_prompt(
                payload.topic,
                structure,
                payload.articleType,
                payload.tone,
                payload.targetLength,
                title or None,
                digest or None,
            )
            async for chunk in provider.stream(body_prompt["system"], body_prompt["user"]):
                if await request.is_disconnected():
                    return
                if not chunk:
                    continue
                body_text += chunk
                yield format_sse("body", {"body": body_text, "delta": chunk})

            if not body_text.strip():
                raise RuntimeError("Invalid wechat body response")

            yield format_sse("step", {"step": "done"})
        except Exception as exc:
            if await request.is_disconnected():
                return
            print(f"[opera-server-py] WeChat compose error ({type(exc).__name__}): {exc!r}")
            yield format_sse("error", {"error": str(exc) or "Unknown error during wechat compose"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
