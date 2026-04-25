import json

from collections.abc import AsyncIterator

import httpx

from app.providers.base import LLMProvider


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

    async def call(self, system: str, user: str) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self._url(),
                headers=self._headers(),
                json={
                    "model": self.model,
                    "max_tokens": 2048,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
            response.raise_for_status()
            payload = response.json()

        content = payload.get("content") or []
        if not content or content[0].get("type") != "text":
            raise RuntimeError("Unexpected response type from Anthropic")
        text = content[0].get("text")
        if not text:
            raise RuntimeError("Empty response from Anthropic")
        return text

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                self._url(),
                headers=self._headers(),
                json={
                    "model": self.model,
                    "max_tokens": 2048,
                    "stream": True,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue

                    raw = line[6:].strip()
                    if not raw or raw == "[DONE]":
                        continue

                    payload = json.loads(raw)
                    payload_type = payload.get("type")

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
