from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import VALID_PROVIDER_VALUES, get_settings
from app.prompts_rewrite import build_rewrite_paragraph_prompt
from app.providers.factory import create_provider, is_model_allowed
from app.routes._shared import VALID_PROVIDERS, logger, parse_json_body
from app.types import RewriteParagraphRequestModel, RewriteParagraphResult

router = APIRouter(prefix="/api")

MAX_PARAGRAPH_LENGTH = 10_000
MAX_REWRITE_INSTRUCTION_LENGTH = 1_000
MAX_MODEL_LENGTH = 200


def validate_request(body: Any) -> tuple[bool, str | None, RewriteParagraphRequestModel | None]:
    if body is None or not isinstance(body, dict):
        return False, "Request body is required", None

    text = body.get("text")
    instruction = body.get("instruction")
    provider = body.get("provider")
    model = body.get("model")

    if not isinstance(text, str) or not text.strip():
        return False, "text is required and must be non-empty", None
    text = text.strip()
    if len(text) > MAX_PARAGRAPH_LENGTH:
        return False, f"text exceeds maximum length of {MAX_PARAGRAPH_LENGTH} characters", None

    if not isinstance(instruction, str) or not instruction.strip():
        return False, "instruction is required and must be non-empty", None
    instruction = instruction.strip()
    if len(instruction) > MAX_REWRITE_INSTRUCTION_LENGTH:
        return (
            False,
            f"instruction exceeds maximum length of {MAX_REWRITE_INSTRUCTION_LENGTH} characters",
            None,
        )

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
        if len(model) > MAX_MODEL_LENGTH:
            return False, f"model exceeds maximum length of {MAX_MODEL_LENGTH} characters", None

    return True, None, RewriteParagraphRequestModel(
        text=text,
        instruction=instruction,
        provider=provider,
        model=model,
    )


@router.post("/rewrite-paragraph")
async def rewrite_paragraph(request: Request):
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
        logger.exception("Paragraph rewrite provider is unavailable")
        return JSONResponse(
            status_code=400,
            content={"error": "Selected provider is not available"},
        )

    prompt = build_rewrite_paragraph_prompt(payload.text, payload.instruction)
    try:
        raw_text = await provider.call(prompt["system"], prompt["user"])
    except Exception:
        logger.exception("Paragraph rewrite provider call failed")
        return JSONResponse(
            status_code=502,
            content={"error": "Paragraph rewrite failed"},
        )

    if not isinstance(raw_text, str) or not raw_text.strip():
        logger.error("Paragraph rewrite provider returned an empty response")
        return JSONResponse(
            status_code=502,
            content={"error": "Paragraph rewrite failed"},
        )

    return RewriteParagraphResult(text=raw_text.strip()).model_dump()
