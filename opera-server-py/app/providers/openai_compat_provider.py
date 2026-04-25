import json

from collections.abc import AsyncIterator

import httpx

from app.providers.base import LLMProvider


class OpenAICompatProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def _chat_url(self) -> str:
        if self.base_url.endswith("/v1"):
            return f"{self.base_url}/chat/completions"
        return f"{self.base_url}/v1/chat/completions"

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    def _payload(self, system: str, user: str, *, stream: bool = False) -> dict[str, object]:
        return {
            "model": self.model,
            "max_tokens": 2048,
            "stream": stream,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }

    def _normalize_content(self, content: object) -> str:
        if isinstance(content, str):
            return content

        if isinstance(content, dict):
            text = content.get("text")
            return text if isinstance(text, str) else ""

        if isinstance(content, list):
            chunks: list[str] = []
            for item in content:
                if isinstance(item, str):
                    chunks.append(item)
                    continue
                if not isinstance(item, dict):
                    continue
                text = item.get("text")
                if isinstance(text, str):
                    chunks.append(text)
            return "".join(chunks)

        return ""

    async def call(self, system: str, user: str) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self._chat_url(),
                headers=self._headers(),
                json=self._payload(system, user),
            )
            response.raise_for_status()
            payload = response.json()

        content = ((payload.get("choices") or [{}])[0].get("message") or {}).get("content")
        normalized = self._normalize_content(content)
        if normalized:
            return normalized
        raise RuntimeError("Unexpected response type from OpenAI-compatible API")

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                self._chat_url(),
                headers=self._headers(),
                json=self._payload(system, user, stream=True),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue

                    raw = line[6:].strip()
                    if not raw or raw == "[DONE]":
                        continue

                    payload = json.loads(raw)
                    delta = ((payload.get("choices") or [{}])[0].get("delta") or {}).get("content")
                    normalized = self._normalize_content(delta)
                    if normalized:
                        yield normalized
