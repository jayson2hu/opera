from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import VALID_PROVIDER_VALUES, get_settings
from app.prompts_wechat import (
    build_wechat_body_prompt,
    build_wechat_digest_prompt,
    build_wechat_extraction_prompt,
    build_wechat_title_prompt,
)
from app.providers.base import stream_with_budget
from app.providers.factory import create_provider, is_model_allowed
from app.routes._shared import (
    VALID_LENGTH_VALUES,
    VALID_LENGTHS,
    VALID_PROVIDERS,
    VALID_TONE_VALUES,
    VALID_TONES,
    OUTPUT_MAX_TOKENS,
    logger,
    parse_json_body,
    safe_stream_error,
    sse_response,
)
from app.routes._current_content import parse_current_content, stream_current_content
from app.sse import format_sse
from app.types import (
    WeChatArticleType,
    WeChatComposeRequestModel,
    WeChatRegenerateTarget,
)
from app.utils import extract_json

router = APIRouter(prefix="/api")
VALID_ARTICLE_TYPE_VALUES: tuple[WeChatArticleType, ...] = (
    "insight",
    "guide",
    "story",
    "briefing",
)
VALID_REGENERATE_VALUES: tuple[WeChatRegenerateTarget, ...] = ("title", "digest", "body")
VALID_ARTICLE_TYPES: set[WeChatArticleType] = set(VALID_ARTICLE_TYPE_VALUES)
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

    if not isinstance(article_type, str) or article_type not in VALID_ARTICLE_TYPES:
        return False, f"articleType must be one of: {', '.join(VALID_ARTICLE_TYPE_VALUES)}", None

    if not isinstance(tone, str) or tone not in VALID_TONES:
        return False, f"tone must be one of: {', '.join(VALID_TONE_VALUES)}", None

    if not isinstance(target_length, str) or target_length not in VALID_LENGTHS:
        return False, f"targetLength must be one of: {', '.join(VALID_LENGTH_VALUES)}", None

    if provider is not None and (
        not isinstance(provider, str) or provider not in VALID_PROVIDERS
    ):
        return False, f"provider must be one of: {', '.join(VALID_PROVIDER_VALUES)}", None

    if model is not None:
        if not isinstance(model, str):
            return False, "model must be a string", None
        model = model.strip()
        if not model:
            return False, "model must be a non-empty string", None

    if regenerate is not None and (
        not isinstance(regenerate, str) or regenerate not in VALID_REGENERATES
    ):
        return False, f"regenerate must be one of: {', '.join(VALID_REGENERATE_VALUES)}", None

    current_content, context_error = parse_current_content(body.get("currentContent"))
    if context_error:
        return False, context_error, None

    return True, None, WeChatComposeRequestModel(
        topic=topic,
        articleType=article_type,
        tone=tone,
        targetLength=target_length,
        provider=provider,
        model=model,
        regenerate=regenerate,
        currentContent=current_content,
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
            if payload.currentContent is not None and payload.regenerate is not None:
                async for event in stream_current_content(request, payload, provider, "wechat"):
                    yield event
                return

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
            async for chunk in stream_with_budget(
                provider,
                body_prompt["system"],
                body_prompt["user"],
                max_tokens=OUTPUT_MAX_TOKENS[payload.targetLength],
            ):
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
            logger.exception("WeChat compose error")
            yield format_sse(
                "error",
                {"error": safe_stream_error(exc, "WeChat composition failed. Please try again.")},
            )

    return sse_response(event_stream())
