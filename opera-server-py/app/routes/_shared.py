"""Shared helpers for the streaming generation routes.

Removes the validation constants, JSON body parsing, SSE response construction and
string-list validation that were duplicated across generate / compose / wechat_compose.
"""

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import Request
from fastapi.responses import StreamingResponse

from app.config import VALID_PROVIDER_VALUES
from app.providers.base import (
    ProviderResponseRejectedError,
    ProviderResponseTimeoutError,
    ProviderResponseTruncatedError,
)
from app.types import ProviderId, TargetLength, ToneType

logger = logging.getLogger("opera-server-py")

VALID_TONE_VALUES: tuple[ToneType, ...] = ("knowledge", "casual", "bff")
VALID_LENGTH_VALUES: tuple[TargetLength, ...] = ("short", "medium", "long")
VALID_TONES: set[ToneType] = set(VALID_TONE_VALUES)
VALID_LENGTHS: set[TargetLength] = set(VALID_LENGTH_VALUES)
VALID_PROVIDERS: set[ProviderId] = set(VALID_PROVIDER_VALUES)

# Budgets are deliberately tied to the requested output size.  The previous
# fixed 2048-token limit could end a long-form stream cleanly at the provider
# boundary while the route still emitted a misleading ``done`` event.
OUTPUT_MAX_TOKENS: dict[TargetLength, int] = {
    "short": 2048,
    "medium": 3072,
    "long": 4096,
}

_SAFE_PROVIDER_RESPONSE_ERRORS = frozenset(
    {
        "Invalid extraction response",
        "Invalid titles response",
        "Invalid cards response",
        "Invalid caption response",
        "Invalid tags response",
        "Invalid composer extraction response",
        "Invalid composer title response",
        "Invalid composer body response",
        "Invalid composer tags response",
        "Invalid composer image keywords response",
        "Invalid wechat extraction response",
        "Invalid wechat title response",
        "Invalid wechat digest response",
        "Invalid wechat body response",
    }
)

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


async def parse_json_body(request: Request) -> Any:
    """Return the parsed JSON body, or None when the body is missing/invalid."""
    try:
        return await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def sse_response(event_stream: AsyncIterator[bytes]) -> StreamingResponse:
    """Wrap an SSE event generator in a StreamingResponse with the standard headers."""
    return StreamingResponse(
        event_stream,
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


def require_string_list(value: Any, error_message: str, *, allow_empty: bool = False) -> list[str]:
    """Validate that ``value`` is a list of strings.

    With ``allow_empty=True`` the list is returned unchanged and empty strings are
    permitted. Otherwise each item must be non-empty and the returned items are stripped.
    """
    if not isinstance(value, list):
        raise RuntimeError(error_message)

    if allow_empty:
        if not all(isinstance(item, str) for item in value):
            raise RuntimeError(error_message)
        return value

    if not all(isinstance(item, str) and item.strip() for item in value):
        raise RuntimeError(error_message)
    return [item.strip() for item in value]


def safe_stream_error(exc: Exception, fallback: str) -> str:
    """Map provider failures to stable client-safe SSE messages."""
    if isinstance(exc, ProviderResponseRejectedError):
        return (
            "The AI provider declined this request for safety reasons. "
            "Revise the content and try again."
        )
    if isinstance(exc, ProviderResponseTimeoutError):
        return (
            "The AI provider timed out before completing the response. "
            "Please try again."
        )
    if isinstance(exc, ProviderResponseTruncatedError):
        return (
            "The AI provider stopped before completing the response. "
            "Try again or choose a shorter length."
        )
    if str(exc) in _SAFE_PROVIDER_RESPONSE_ERRORS:
        return str(exc)
    return fallback
