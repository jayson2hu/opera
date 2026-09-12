from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from inspect import Parameter, signature
from typing import Any, Awaitable, Callable

import httpx


DEFAULT_MAX_TOKENS = 2048
PROVIDER_STREAM_TIMEOUT = httpx.Timeout(
    connect=10.0,
    write=30.0,
    read=120.0,
    pool=10.0,
)
TRUNCATED_FINISH_REASONS = frozenset(
    {"length", "max_tokens", "max_output_tokens", "model_context_window_exceeded"}
)
REJECTED_FINISH_REASONS = frozenset({"content_filter", "refusal", "safety"})


class ProviderResponseTruncatedError(RuntimeError):
    """Raised when a provider reports or exhibits an incomplete response."""


class ProviderResponseRejectedError(RuntimeError):
    """Raised when a provider declines a response for safety-policy reasons."""


class ProviderResponseTimeoutError(RuntimeError):
    """Raised when a provider does not complete a request within bounded time."""


def is_truncated_finish_reason(reason: object) -> bool:
    return isinstance(reason, str) and reason in TRUNCATED_FINISH_REASONS


def is_rejected_finish_reason(reason: object) -> bool:
    return isinstance(reason, str) and reason in REJECTED_FINISH_REASONS


def _accepts_max_tokens(method: Callable[..., object]) -> bool:
    """Keep older test/custom providers compatible with task-specific budgets."""
    try:
        parameters = signature(method).parameters.values()
    except (TypeError, ValueError):
        return True
    return any(
        parameter.name == "max_tokens" or parameter.kind is Parameter.VAR_KEYWORD
        for parameter in parameters
    )


async def call_with_budget(
    provider: Any,
    system: str,
    user: str,
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> str:
    call: Callable[..., Awaitable[str]] = provider.call
    if _accepts_max_tokens(call):
        return await call(system, user, max_tokens=max_tokens)
    return await call(system, user)


async def stream_with_budget(
    provider: Any,
    system: str,
    user: str,
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> AsyncIterator[str]:
    stream = provider.stream
    if _accepts_max_tokens(stream):
        iterator = stream(system, user, max_tokens=max_tokens)
    else:
        iterator = stream(system, user)
    async for chunk in iterator:
        yield chunk


class LLMProvider(ABC):
    @abstractmethod
    async def call(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        raise NotImplementedError

    async def stream(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> AsyncIterator[str]:
        yield await call_with_budget(self, system, user, max_tokens=max_tokens)
