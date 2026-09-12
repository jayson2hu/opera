import json

from collections.abc import AsyncIterator

import httpx

from app.providers.base import (
    DEFAULT_MAX_TOKENS,
    LLMProvider,
    PROVIDER_STREAM_TIMEOUT,
    ProviderResponseRejectedError,
    ProviderResponseTimeoutError,
    ProviderResponseTruncatedError,
    is_rejected_finish_reason,
    is_truncated_finish_reason,
)


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def _url(self) -> str:
        return f"{self.base_url}/v1/messages"

    def _headers(self) -> dict[str, str]:
        return {
            "content-type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

    async def call(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self._url(),
                headers=self._headers(),
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
            response.raise_for_status()
            payload = response.json()

        message = payload.get("message") or {}
        stop_reason = payload.get("stop_reason")
        if isinstance(message, dict) and stop_reason is None:
            stop_reason = message.get("stop_reason")
        if is_rejected_finish_reason(stop_reason):
            raise ProviderResponseRejectedError("Provider response was rejected")
        if is_truncated_finish_reason(stop_reason):
            raise ProviderResponseTruncatedError("Provider response was truncated")

        content = payload.get("content") or []
        if not isinstance(content, list) or not content:
            raise RuntimeError("Unexpected response type from Anthropic")
        text_chunks = [
            block.get("text")
            for block in content
            if isinstance(block, dict)
            and block.get("type") == "text"
            and isinstance(block.get("text"), str)
        ]
        text = "".join(text_chunks)
        if not text:
            raise RuntimeError("Empty response from Anthropic")
        return text

    async def stream(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> AsyncIterator[str]:
        completed = False
        rejected = False
        truncated = False
        try:
            async with httpx.AsyncClient(timeout=PROVIDER_STREAM_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    self._url(),
                    headers=self._headers(),
                    json={
                        "model": self.model,
                        "max_tokens": max_tokens,
                        "stream": True,
                        "system": system,
                        "messages": [{"role": "user", "content": user}],
                    },
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue

                        raw = line[5:].strip()
                        if not raw:
                            continue
                        if raw == "[DONE]":
                            completed = True
                            continue

                        payload = json.loads(raw)
                        payload_type = payload.get("type")

                        payload_stop_reason = payload.get("stop_reason")
                        if isinstance(payload_stop_reason, str) and payload_stop_reason:
                            completed = True
                        if is_rejected_finish_reason(payload_stop_reason):
                            rejected = True
                        if is_truncated_finish_reason(payload_stop_reason):
                            truncated = True

                        if payload_type == "message_delta":
                            delta = payload.get("delta") or {}
                            stop_reason = delta.get("stop_reason")
                            if isinstance(stop_reason, str) and stop_reason:
                                completed = True
                            if is_rejected_finish_reason(stop_reason):
                                rejected = True
                            if is_truncated_finish_reason(stop_reason):
                                truncated = True
                            continue

                        if payload_type == "message_start":
                            message = payload.get("message") or {}
                            stop_reason = message.get("stop_reason")
                            if isinstance(stop_reason, str) and stop_reason:
                                completed = True
                            if is_rejected_finish_reason(stop_reason):
                                rejected = True
                            if is_truncated_finish_reason(stop_reason):
                                truncated = True
                            continue

                        if payload_type == "message_stop":
                            completed = True
                            continue

                        if payload_type == "content_block_start":
                            content_block = payload.get("content_block") or {}
                            text = content_block.get("text")
                            if isinstance(text, str) and text:
                                yield text
                            continue

                        if payload_type != "content_block_delta":
                            continue

                        delta = payload.get("delta") or {}
                        if delta.get("type") != "text_delta":
                            continue

                        text = delta.get("text")
                        if isinstance(text, str) and text:
                            yield text
        except httpx.TimeoutException:
            raise ProviderResponseTimeoutError("Provider response timed out") from None

        if rejected:
            raise ProviderResponseRejectedError("Provider response was rejected")
        if truncated or not completed:
            raise ProviderResponseTruncatedError("Provider response was truncated")
