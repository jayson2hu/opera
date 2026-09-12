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

    def _payload(
        self,
        system: str,
        user: str,
        *,
        stream: bool = False,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> dict[str, object]:
        return {
            "model": self.model,
            "max_tokens": max_tokens,
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

    async def call(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self._chat_url(),
                headers=self._headers(),
                json=self._payload(system, user, max_tokens=max_tokens),
            )
            response.raise_for_status()
            payload = response.json()

        choice = (payload.get("choices") or [{}])[0]
        incomplete_details = payload.get("incomplete_details") or {}
        incomplete_reason = (
            incomplete_details.get("reason")
            if isinstance(incomplete_details, dict)
            else None
        )
        reasons = (
            choice.get("finish_reason"),
            payload.get("finish_reason"),
            incomplete_reason,
        )
        if any(is_rejected_finish_reason(reason) for reason in reasons):
            raise ProviderResponseRejectedError("Provider response was rejected")
        if any(is_truncated_finish_reason(reason) for reason in reasons):
            raise ProviderResponseTruncatedError("Provider response was truncated")

        message = choice.get("message") or {}
        if isinstance(message, dict):
            refusal = message.get("refusal")
            if isinstance(refusal, str) and refusal.strip():
                raise ProviderResponseRejectedError("Provider response was rejected")
            content = message.get("content")
        else:
            content = None
        normalized = self._normalize_content(content)
        if normalized:
            return normalized
        raise RuntimeError("Unexpected response type from OpenAI-compatible API")

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
                    self._chat_url(),
                    headers=self._headers(),
                    json=self._payload(system, user, stream=True, max_tokens=max_tokens),
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue

                        raw = line[6:].strip()
                        if not raw:
                            continue
                        if raw == "[DONE]":
                            completed = True
                            continue

                        payload = json.loads(raw)
                        choice = (payload.get("choices") or [{}])[0]
                        incomplete_details = payload.get("incomplete_details") or {}
                        incomplete_reason = (
                            incomplete_details.get("reason")
                            if isinstance(incomplete_details, dict)
                            else None
                        )
                        reasons = (
                            choice.get("finish_reason"),
                            payload.get("finish_reason"),
                            incomplete_reason,
                        )
                        if any(isinstance(reason, str) and reason for reason in reasons):
                            completed = True
                        if any(is_rejected_finish_reason(reason) for reason in reasons):
                            rejected = True
                        if any(is_truncated_finish_reason(reason) for reason in reasons):
                            truncated = True

                        delta_payload = choice.get("delta") or {}
                        if isinstance(delta_payload, dict):
                            refusal = delta_payload.get("refusal")
                            if isinstance(refusal, str) and refusal.strip():
                                rejected = True
                            delta = delta_payload.get("content")
                        else:
                            delta = None
                        normalized = self._normalize_content(delta)
                        if normalized:
                            yield normalized
        except httpx.TimeoutException:
            raise ProviderResponseTimeoutError("Provider response timed out") from None

        if rejected:
            raise ProviderResponseRejectedError("Provider response was rejected")
        if truncated or not completed:
            raise ProviderResponseTruncatedError("Provider response was truncated")
