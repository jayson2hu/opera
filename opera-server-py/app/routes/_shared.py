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
from app.types import ProviderId, TargetLength, ToneType

logger = logging.getLogger("opera-server-py")

VALID_TONE_VALUES: tuple[ToneType, ...] = ("knowledge", "casual", "bff")
VALID_LENGTH_VALUES: tuple[TargetLength, ...] = ("short", "medium", "long")
VALID_TONES: set[ToneType] = set(VALID_TONE_VALUES)
VALID_LENGTHS: set[TargetLength] = set(VALID_LENGTH_VALUES)
VALID_PROVIDERS: set[ProviderId] = set(VALID_PROVIDER_VALUES)

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


async def parse_json_body(request: Request) -> Any:
    """Return the parsed JSON body, or None when the body is missing/invalid."""
    try:
        return await request.json()
    except json.JSONDecodeError:
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

    With ``allow_empty=True`` (the adapter/generate behaviour) the list is returned
    unchanged and empty strings are permitted. Otherwise (the composer behaviour) each
    item must be non-empty and the returned items are stripped.
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
