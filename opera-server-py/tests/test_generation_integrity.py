import asyncio
import json
import os
from collections.abc import AsyncIterator, Iterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("AI_PROVIDER", "deepseek")
os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")
os.environ.setdefault("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
os.environ.setdefault("DEEPSEEK_MODEL", "deepseek-chat")

from app.config import VALID_PROVIDER_VALUES, get_settings
from app.main import create_app
from app.providers.anthropic_provider import AnthropicProvider
from app.providers.base import (
    ProviderResponseRejectedError,
    ProviderResponseTimeoutError,
    ProviderResponseTruncatedError,
)
from app.providers.openai_compat_provider import OpenAICompatProvider
from app.routes import compose as compose_route
from app.routes import generate as generate_route
from app.routes import wechat_compose as wechat_route
from app.routes._shared import safe_stream_error


def parse_sse(response: Any) -> list[tuple[str, dict[str, object]]]:
    events: list[tuple[str, dict[str, object]]] = []
    event_name = ""
    for line in response.iter_lines():
        if line.startswith("event: "):
            event_name = line[7:].strip()
        elif line.startswith("data: ") and event_name:
            events.append((event_name, json.loads(line[6:])))
            event_name = ""
    return events


@pytest.fixture
def client() -> Iterator[TestClient]:
    get_settings.cache_clear()
    with TestClient(create_app()) as test_client:
        yield test_client


class SequenceGenerateProvider:
    def __init__(self, responses: list[str]) -> None:
        self.responses = iter(responses)

    async def call(self, _system: str, _user: str) -> str:
        return next(self.responses)


class FailingGenerateProvider:
    async def call(self, _system: str, _user: str) -> str:
        raise RuntimeError("secret upstream URL and credentials")


@pytest.mark.parametrize(
    ("caption", "tag_groups", "expected_error"),
    [
        ("   ", [{"type": "broad", "label": "标签", "tags": ["写作"]}], "Invalid caption response"),
        ("有效发布正文", [], "Invalid tags response"),
        ("有效发布正文", [{"type": "broad", "label": "标签", "tags": []}], "Invalid tags response"),
        ("有效发布正文", [{"type": "broad", "label": "标签", "tags": ["   "]}], "Invalid tags response"),
        ("有效发布正文", [{"type": "broad", "label": "   ", "tags": ["写作"]}], "Invalid tags response"),
    ],
)
def test_generate_rejects_empty_final_outputs_without_done(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caption: str,
    tag_groups: list[dict[str, object]],
    expected_error: str,
) -> None:
    responses = [
        {"coverTitles": ["标题一", "标题二", "标题三"]},
        {"cards": ["卡片一", "卡片二", "卡片三", "卡片四", "卡片五"]},
        {"caption": caption},
        {"tagGroups": tag_groups},
    ]
    monkeypatch.setattr(
        generate_route,
        "create_provider",
        lambda *_args, **_kwargs: SequenceGenerateProvider(
            [json.dumps(response) for response in responses]
        ),
    )
    with client.stream(
        "POST",
        "/api/generate/continue",
        json={"text": "有效的来源文章", "tone": "knowledge", "points": ["观点一", "观点二", "观点三"]},
    ) as response:
        events = parse_sse(response)
    assert events[-1] == ("error", {"error": expected_error})
    assert ("step", {"step": "done"}) not in events


@pytest.mark.parametrize("empty_field", ["tags", "imageKeywords"])
@pytest.mark.parametrize("regenerate", [None, "tags"])
def test_composer_rejects_empty_publish_metadata_without_done(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    empty_field: str,
    regenerate: str | None,
) -> None:
    metadata = {"tags": ["写作"], "imageKeywords": ["书桌"]}
    metadata[empty_field] = []

    class ComposerProvider(SequenceGenerateProvider):
        async def stream(self, _system: str, _user: str) -> AsyncIterator[str]:
            yield "完整且有效的创作正文"

    provider = ComposerProvider([
        json.dumps({
            "angle": "创作流程", "audience": "内容创作者", "hook": "写作技巧", "cta": "尝试练习",
            "outline": ["开始写作", "检查内容", "发布稿件"], "mustMention": ["内容质量"],
        }),
        json.dumps({"title": "有效创作标题"}),
        json.dumps(metadata),
    ])
    monkeypatch.setattr(compose_route, "create_provider", lambda *_args: provider)
    response = client.post("/api/compose", json={
        "topic": "如何建立稳定且可重复使用的内容创作流程",
        "contentType": "knowledge", "tone": "knowledge", "targetLength": "medium",
        "regenerate": regenerate,
    })
    events = parse_sse(response)
    expected_error = (
        "Invalid composer tags response"
        if empty_field == "tags"
        else "Invalid composer image keywords response"
    )
    assert events[-1] == ("error", {"error": expected_error})
    assert not any(name == "tags" for name, _payload in events)
    assert ("step", {"step": "done"}) not in events


@pytest.mark.parametrize(
    "extraction_payload",
    [
        [],
        {"points": ["point one", "point two"]},
        {"points": [f"point {index}" for index in range(9)]},
        {"points": ["point one", "   ", "point three"]},
        {"points": ["point one", 2, "point three"]},
    ],
)
def test_generate_rejects_invalid_extraction_points_without_pausing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    extraction_payload: object,
) -> None:
    monkeypatch.setattr(
        generate_route,
        "create_provider",
        lambda *_args, **_kwargs: SequenceGenerateProvider(
            [json.dumps(extraction_payload)]
        ),
    )

    with client.stream(
        "POST",
        "/api/generate",
        json={"text": "A valid source article.", "tone": "knowledge"},
    ) as response:
        assert response.status_code == 200
        events = parse_sse(response)

    assert events[-1] == ("error", {"error": "Invalid extraction response"})
    assert not any(name == "extraction_points" for name, _payload in events)
    assert not any(
        name == "step" and payload.get("step") in {"paused", "done"}
        for name, payload in events
    )


def test_generate_accepts_legacy_top_level_extraction_points_and_strips_them(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        generate_route,
        "create_provider",
        lambda *_args, **_kwargs: SequenceGenerateProvider(
            ['[" point one ", "point two", "point three"]']
        ),
    )

    with client.stream(
        "POST",
        "/api/generate",
        json={"text": "A valid source article.", "tone": "knowledge"},
    ) as response:
        assert response.status_code == 200
        events = parse_sse(response)

    assert events == [
        ("step", {"step": "extracting"}),
        (
            "extraction_points",
            {"points": ["point one", "point two", "point three"]},
        ),
        ("step", {"step": "paused"}),
    ]


@pytest.mark.parametrize(
    ("responses", "expected_error"),
    [
        (
            ['{"coverTitles": ["valid title", "   ", "another title"]}'],
            "Invalid titles response",
        ),
        (
            [
                '{"coverTitles": ["title 1", "title 2", "title 3"]}',
                '{"cards": ["card 1", "card 2", "card 3", "card 4"]}',
            ],
            "Invalid cards response",
        ),
    ],
)
def test_generate_rejects_incomplete_title_or_card_lists_without_done(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    responses: list[str],
    expected_error: str,
) -> None:
    monkeypatch.setattr(
        generate_route,
        "create_provider",
        lambda *_args, **_kwargs: SequenceGenerateProvider(responses),
    )

    with client.stream(
        "POST",
        "/api/generate/continue",
        json={
            "text": "A source article with enough material to adapt.",
            "tone": "knowledge",
            "points": ["point one", "point two", "point three"],
        },
    ) as response:
        assert response.status_code == 200
        events = parse_sse(response)

    assert events[-1] == ("error", {"error": expected_error})
    assert not any(name == "step" and payload.get("step") == "done" for name, payload in events)


def test_generate_sse_does_not_leak_unknown_upstream_errors(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        generate_route,
        "create_provider",
        lambda *_args, **_kwargs: FailingGenerateProvider(),
    )

    with client.stream(
        "POST",
        "/api/generate/continue",
        json={
            "text": "A source article with enough material to adapt.",
            "tone": "knowledge",
            "points": ["point one", "point two", "point three"],
        },
    ) as response:
        events = parse_sse(response)

    assert events[-1] == ("error", {"error": "Generation failed. Please try again."})
    assert "secret" not in str(events)


@pytest.mark.parametrize(
    ("route_module", "endpoint", "payload"),
    [
        (
            generate_route,
            "/api/generate",
            {"text": "valid source", "tone": "knowledge"},
        ),
        (
            compose_route,
            "/api/compose",
            {
                "topic": "A sufficiently detailed topic",
                "contentType": "knowledge",
                "tone": "knowledge",
                "targetLength": "medium",
            },
        ),
        (
            wechat_route,
            "/api/wechat/compose",
            {
                "topic": "A sufficiently detailed WeChat topic",
                "articleType": "guide",
                "tone": "knowledge",
                "targetLength": "medium",
            },
        ),
    ],
)
def test_provider_creation_errors_do_not_leak_configuration_details(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    route_module: Any,
    endpoint: str,
    payload: dict[str, object],
) -> None:
    def fail_provider(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("secret-key at https://private-provider.example")

    monkeypatch.setattr(route_module, "create_provider", fail_provider)
    response = client.post(endpoint, json=payload)

    assert response.status_code == 400
    assert response.json() == {"error": "Selected provider is not available"}


@pytest.mark.parametrize(
    ("endpoint", "payload", "field", "invalid_value", "expected_error"),
    [
        (
            "/api/generate",
            {"text": "valid source", "tone": "knowledge"},
            "tone",
            [],
            "tone must be one of: knowledge, casual, bff",
        ),
        (
            "/api/generate",
            {"text": "valid source", "tone": "knowledge"},
            "targetLength",
            {},
            "targetLength must be one of: short, medium, long",
        ),
        (
            "/api/generate",
            {"text": "valid source", "tone": "knowledge"},
            "provider",
            [],
            f"provider must be one of: {', '.join(VALID_PROVIDER_VALUES)}",
        ),
        (
            "/api/compose",
            {
                "topic": "A sufficiently detailed topic",
                "contentType": "knowledge",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "contentType",
            [],
            "contentType must be one of: recommend, knowledge, story, tutorial",
        ),
        (
            "/api/compose",
            {
                "topic": "A sufficiently detailed topic",
                "contentType": "knowledge",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "tone",
            {},
            "tone must be one of: knowledge, casual, bff",
        ),
        (
            "/api/compose",
            {
                "topic": "A sufficiently detailed topic",
                "contentType": "knowledge",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "targetLength",
            [],
            "targetLength must be one of: short, medium, long",
        ),
        (
            "/api/compose",
            {
                "topic": "A sufficiently detailed topic",
                "contentType": "knowledge",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "provider",
            {},
            f"provider must be one of: {', '.join(VALID_PROVIDER_VALUES)}",
        ),
        (
            "/api/compose",
            {
                "topic": "A sufficiently detailed topic",
                "contentType": "knowledge",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "regenerate",
            [],
            "regenerate must be one of: title, body, tags",
        ),
        (
            "/api/wechat/compose",
            {
                "topic": "A sufficiently detailed WeChat topic",
                "articleType": "guide",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "articleType",
            [],
            "articleType must be one of: insight, guide, story, briefing",
        ),
        (
            "/api/wechat/compose",
            {
                "topic": "A sufficiently detailed WeChat topic",
                "articleType": "guide",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "tone",
            {},
            "tone must be one of: knowledge, casual, bff",
        ),
        (
            "/api/wechat/compose",
            {
                "topic": "A sufficiently detailed WeChat topic",
                "articleType": "guide",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "targetLength",
            [],
            "targetLength must be one of: short, medium, long",
        ),
        (
            "/api/wechat/compose",
            {
                "topic": "A sufficiently detailed WeChat topic",
                "articleType": "guide",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "provider",
            {},
            f"provider must be one of: {', '.join(VALID_PROVIDER_VALUES)}",
        ),
        (
            "/api/wechat/compose",
            {
                "topic": "A sufficiently detailed WeChat topic",
                "articleType": "guide",
                "tone": "knowledge",
                "targetLength": "medium",
            },
            "regenerate",
            [],
            "regenerate must be one of: title, digest, body",
        ),
    ],
)
def test_enum_fields_reject_unhashable_values_with_400(
    client: TestClient,
    endpoint: str,
    payload: dict[str, object],
    field: str,
    invalid_value: object,
    expected_error: str,
) -> None:
    request_payload = {**payload, field: invalid_value}

    response = client.post(endpoint, json=request_payload)

    assert response.status_code == 400
    assert response.json() == {"error": expected_error}


@pytest.mark.parametrize(
    ("endpoint", "payload"),
    [
        (
            "/api/generate",
            {"text": "valid source", "tone": "knowledge"},
        ),
        (
            "/api/generate/continue",
            {
                "text": "valid source",
                "tone": "knowledge",
                "points": ["point one", "point two", "point three"],
            },
        ),
        (
            "/api/compose",
            {
                "topic": "A sufficiently detailed topic",
                "contentType": "knowledge",
                "tone": "knowledge",
                "targetLength": "medium",
            },
        ),
        (
            "/api/wechat/compose",
            {
                "topic": "A sufficiently detailed WeChat topic",
                "articleType": "guide",
                "tone": "knowledge",
                "targetLength": "medium",
            },
        ),
        (
            "/api/rewrite-paragraph",
            {"text": "original paragraph", "instruction": "make it shorter"},
        ),
    ],
)
def test_routes_reject_models_outside_the_provider_allowlist(
    client: TestClient,
    endpoint: str,
    payload: dict[str, object],
) -> None:
    response = client.post(
        endpoint,
        json={**payload, "provider": "deepseek", "model": "unapproved-premium-model"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "error": "model is not available for the selected provider"
    }


class BudgetWeChatProvider:
    def __init__(self, budgets: list[int], *, truncate: bool = False) -> None:
        self.budgets = budgets
        self.truncate = truncate

    async def call(self, _system: str, _user: str) -> str:
        return json.dumps(
            {
                "angle": "clear angle",
                "audience": "content creators",
                "promise": "a repeatable workflow",
                "outline": ["problem", "method", "result"],
                "keyPoints": ["first point", "second point"],
                "cta": "try the workflow",
            }
        )

    async def stream(
        self,
        _system: str,
        _user: str,
        *,
        max_tokens: int,
    ) -> AsyncIterator[str]:
        self.budgets.append(max_tokens)
        yield "partial body"
        if self.truncate:
            raise ProviderResponseTruncatedError("upstream secret details")


class RejectedWeChatProvider(BudgetWeChatProvider):
    async def stream(
        self,
        _system: str,
        _user: str,
        *,
        max_tokens: int,
    ) -> AsyncIterator[str]:
        self.budgets.append(max_tokens)
        yield "partial body"
        raise ProviderResponseRejectedError("upstream secret policy details")


class TimedOutWeChatProvider(BudgetWeChatProvider):
    async def stream(
        self,
        _system: str,
        _user: str,
        *,
        max_tokens: int,
    ) -> AsyncIterator[str]:
        self.budgets.append(max_tokens)
        yield "partial body"
        raise ProviderResponseTimeoutError("secret provider URL and token")


@pytest.mark.parametrize(
    ("target_length", "expected_budget"),
    [("short", 2048), ("medium", 3072), ("long", 4096)],
)
def test_wechat_body_uses_target_length_output_budget(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    target_length: str,
    expected_budget: int,
) -> None:
    budgets: list[int] = []
    monkeypatch.setattr(
        wechat_route,
        "create_provider",
        lambda *_args, **_kwargs: BudgetWeChatProvider(budgets),
    )

    with client.stream(
        "POST",
        "/api/wechat/compose",
        json={
            "topic": "A complete WeChat article topic for generation",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": target_length,
            "regenerate": "body",
        },
    ) as response:
        events = parse_sse(response)

    assert budgets == [expected_budget]
    assert events[-1] == ("step", {"step": "done"})


def test_wechat_truncated_stream_emits_safe_error_without_done(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        wechat_route,
        "create_provider",
        lambda *_args, **_kwargs: BudgetWeChatProvider([], truncate=True),
    )

    with client.stream(
        "POST",
        "/api/wechat/compose",
        json={
            "topic": "A complete WeChat article topic for generation",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "long",
            "regenerate": "body",
        },
    ) as response:
        events = parse_sse(response)

    assert events[-1] == (
        "error",
        {
            "error": (
                "The AI provider stopped before completing the response. "
                "Try again or choose a shorter length."
            )
        },
    )
    assert "secret" not in str(events)
    assert not any(name == "step" and payload.get("step") == "done" for name, payload in events)


def test_wechat_rejected_stream_emits_safe_error_without_done(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        wechat_route,
        "create_provider",
        lambda *_args, **_kwargs: RejectedWeChatProvider([]),
    )

    with client.stream(
        "POST",
        "/api/wechat/compose",
        json={
            "topic": "A complete WeChat article topic for generation",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "long",
            "regenerate": "body",
        },
    ) as response:
        events = parse_sse(response)

    assert events[-1] == (
        "error",
        {
            "error": (
                "The AI provider declined this request for safety reasons. "
                "Revise the content and try again."
            )
        },
    )
    assert "secret" not in str(events)
    assert not any(name == "step" and payload.get("step") == "done" for name, payload in events)


def test_wechat_timed_out_stream_emits_safe_error_without_done(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        wechat_route,
        "create_provider",
        lambda *_args, **_kwargs: TimedOutWeChatProvider([]),
    )

    with client.stream(
        "POST",
        "/api/wechat/compose",
        json={
            "topic": "A complete WeChat article topic for generation",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "long",
            "regenerate": "body",
        },
    ) as response:
        events = parse_sse(response)

    assert events[-1] == (
        "error",
        {
            "error": (
                "The AI provider timed out before completing the response. "
                "Please try again."
            )
        },
    )
    assert "secret" not in str(events)
    assert not any(name == "step" and payload.get("step") == "done" for name, payload in events)


class FakeHTTPResponse:
    def __init__(
        self,
        *,
        payload: dict[str, object] | None = None,
        lines: list[str] | None = None,
        line_error: Exception | None = None,
    ) -> None:
        self.payload = payload or {}
        self.lines = lines or []
        self.line_error = line_error

    async def __aenter__(self) -> "FakeHTTPResponse":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self.payload

    async def aiter_lines(self) -> AsyncIterator[str]:
        for line in self.lines:
            yield line
        if self.line_error is not None:
            raise self.line_error


def fake_async_client(
    requests: list[dict[str, object]],
    *,
    client_options: list[dict[str, object]] | None = None,
    payload: dict[str, object] | None = None,
    lines: list[str] | None = None,
    line_error: Exception | None = None,
) -> type:
    class FakeAsyncClient:
        def __init__(self, *_args: object, **kwargs: object) -> None:
            if client_options is not None:
                client_options.append(kwargs)

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def post(self, _url: str, **kwargs: object) -> FakeHTTPResponse:
            requests.append(kwargs)
            return FakeHTTPResponse(payload=payload)

        def stream(self, _method: str, _url: str, **kwargs: object) -> FakeHTTPResponse:
            requests.append(kwargs)
            return FakeHTTPResponse(lines=lines, line_error=line_error)

    return FakeAsyncClient


def test_anthropic_call_honors_budget_and_rejects_max_tokens_stop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict[str, object]] = []
    client_type = fake_async_client(
        requests,
        payload={
            "stop_reason": "max_tokens",
            "content": [{"type": "text", "text": "partial"}],
        },
    )
    monkeypatch.setattr("app.providers.anthropic_provider.httpx.AsyncClient", client_type)
    provider = AnthropicProvider("key", "https://anthropic.example", "model")

    with pytest.raises(ProviderResponseTruncatedError):
        asyncio.run(provider.call("system", "user", max_tokens=4096))

    assert requests[0]["json"]["max_tokens"] == 4096  # type: ignore[index]


@pytest.mark.parametrize(
    ("provider", "lines"),
    [
        (
            AnthropicProvider("key", "https://anthropic.example", "model"),
            [
                'data:{"type":"content_block_delta","delta":{"type":"text_delta","text":"完整正文"}}',
                'data:{"type":"message_stop"}',
            ],
        ),
        (
            OpenAICompatProvider("key", "https://openai.example/v1", "model"),
            [
                'data:{"choices":[{"delta":{"content":"完整正文"},"finish_reason":null}]}',
                'data:{"choices":[{"delta":{},"finish_reason":"stop"}]}',
                'data:[DONE]',
            ],
        ),
    ],
)
def test_provider_stream_accepts_data_without_optional_space(
    monkeypatch: pytest.MonkeyPatch,
    provider: AnthropicProvider | OpenAICompatProvider,
    lines: list[str],
) -> None:
    monkeypatch.setattr(httpx, "AsyncClient", fake_async_client([], lines=lines))

    async def collect() -> str:
        return "".join([chunk async for chunk in provider.stream("system", "user")])

    assert asyncio.run(collect()) == "完整正文"


def test_anthropic_call_combines_multiple_text_blocks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict[str, object]] = []
    client_type = fake_async_client(
        requests,
        payload={
            "stop_reason": "end_turn",
            "content": [
                {"type": "text", "text": '{"cards":'},
                {"type": "text", "text": "[]}"},
            ],
        },
    )
    monkeypatch.setattr("app.providers.anthropic_provider.httpx.AsyncClient", client_type)
    provider = AnthropicProvider("key", "https://anthropic.example", "model")

    assert asyncio.run(provider.call("system", "user")) == '{"cards":[]}'


def test_openai_call_honors_budget_and_rejects_length_finish(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict[str, object]] = []
    client_type = fake_async_client(
        requests,
        payload={
            "choices": [
                {
                    "finish_reason": "length",
                    "message": {"content": "partial"},
                }
            ]
        },
    )
    monkeypatch.setattr("app.providers.openai_compat_provider.httpx.AsyncClient", client_type)
    provider = OpenAICompatProvider("key", "https://openai.example/v1", "model")

    with pytest.raises(ProviderResponseTruncatedError):
        asyncio.run(provider.call("system", "user", max_tokens=3072))

    assert requests[0]["json"]["max_tokens"] == 3072  # type: ignore[index]


@pytest.mark.parametrize(
    ("provider", "patch_target", "payload"),
    [
        (
            AnthropicProvider("key", "https://anthropic.example", "model"),
            "app.providers.anthropic_provider.httpx.AsyncClient",
            {
                "stop_reason": "refusal",
                "content": [{"type": "text", "text": "policy refusal"}],
            },
        ),
        (
            OpenAICompatProvider("key", "https://openai.example/v1", "model"),
            "app.providers.openai_compat_provider.httpx.AsyncClient",
            {
                "choices": [
                    {
                        "finish_reason": "content_filter",
                        "message": {"content": "partial"},
                    }
                ]
            },
        ),
        (
            OpenAICompatProvider("key", "https://openai.example/v1", "model"),
            "app.providers.openai_compat_provider.httpx.AsyncClient",
            {
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": None, "refusal": "policy refusal"},
                    }
                ]
            },
        ),
    ],
)
def test_provider_calls_classify_safety_rejections(
    monkeypatch: pytest.MonkeyPatch,
    provider: AnthropicProvider | OpenAICompatProvider,
    patch_target: str,
    payload: dict[str, object],
) -> None:
    requests: list[dict[str, object]] = []
    monkeypatch.setattr(patch_target, fake_async_client(requests, payload=payload))

    with pytest.raises(ProviderResponseRejectedError):
        asyncio.run(provider.call("system", "user"))


@pytest.mark.parametrize(
    ("provider", "patch_target", "lines"),
    [
        (
            AnthropicProvider("key", "https://anthropic.example", "model"),
            "app.providers.anthropic_provider.httpx.AsyncClient",
            [
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}',
                'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}',
            ],
        ),
        (
            OpenAICompatProvider("key", "https://openai.example/v1", "model"),
            "app.providers.openai_compat_provider.httpx.AsyncClient",
            [
                'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}',
                'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
                "data: [DONE]",
            ],
        ),
    ],
)
def test_provider_streams_raise_after_partial_truncated_output(
    monkeypatch: pytest.MonkeyPatch,
    provider: AnthropicProvider | OpenAICompatProvider,
    patch_target: str,
    lines: list[str],
) -> None:
    requests: list[dict[str, object]] = []
    monkeypatch.setattr(patch_target, fake_async_client(requests, lines=lines))

    async def collect() -> list[str]:
        chunks: list[str] = []
        with pytest.raises(ProviderResponseTruncatedError):
            async for chunk in provider.stream("system", "user", max_tokens=4096):
                chunks.append(chunk)
        return chunks

    assert asyncio.run(collect()) == ["partial"]
    assert requests[0]["json"]["max_tokens"] == 4096  # type: ignore[index]


@pytest.mark.parametrize(
    ("provider", "patch_target", "lines"),
    [
        (
            AnthropicProvider("key", "https://anthropic.example", "model"),
            "app.providers.anthropic_provider.httpx.AsyncClient",
            [
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}',
            ],
        ),
        (
            OpenAICompatProvider("key", "https://openai.example/v1", "model"),
            "app.providers.openai_compat_provider.httpx.AsyncClient",
            [
                'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}',
            ],
        ),
    ],
)
def test_provider_streams_use_bounded_timeouts_and_hide_stall_details(
    monkeypatch: pytest.MonkeyPatch,
    provider: AnthropicProvider | OpenAICompatProvider,
    patch_target: str,
    lines: list[str],
) -> None:
    requests: list[dict[str, object]] = []
    client_options: list[dict[str, object]] = []
    monkeypatch.setattr(
        patch_target,
        fake_async_client(
            requests,
            client_options=client_options,
            lines=lines,
            line_error=httpx.ReadTimeout(
                "secret stall at https://private-provider.example?token=secret"
            ),
        ),
    )

    async def collect() -> tuple[list[str], ProviderResponseTimeoutError]:
        chunks: list[str] = []
        with pytest.raises(ProviderResponseTimeoutError) as caught:
            async for chunk in provider.stream("system", "user"):
                chunks.append(chunk)
        return chunks, caught.value

    chunks, error = asyncio.run(collect())

    assert chunks == ["partial"]
    assert str(error) == "Provider response timed out"
    assert "secret" not in str(error)
    timeout = client_options[0]["timeout"]
    assert isinstance(timeout, httpx.Timeout)
    assert (timeout.connect, timeout.write, timeout.read, timeout.pool) == (
        10.0,
        30.0,
        120.0,
        10.0,
    )


@pytest.mark.parametrize(
    ("provider", "patch_target", "lines"),
    [
        (
            AnthropicProvider("key", "https://anthropic.example", "model"),
            "app.providers.anthropic_provider.httpx.AsyncClient",
            [
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}',
            ],
        ),
        (
            OpenAICompatProvider("key", "https://openai.example/v1", "model"),
            "app.providers.openai_compat_provider.httpx.AsyncClient",
            [
                'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}',
            ],
        ),
    ],
)
def test_provider_streams_reject_eof_without_terminal_marker(
    monkeypatch: pytest.MonkeyPatch,
    provider: AnthropicProvider | OpenAICompatProvider,
    patch_target: str,
    lines: list[str],
) -> None:
    requests: list[dict[str, object]] = []
    monkeypatch.setattr(patch_target, fake_async_client(requests, lines=lines))

    async def collect() -> list[str]:
        chunks: list[str] = []
        with pytest.raises(ProviderResponseTruncatedError):
            async for chunk in provider.stream("system", "user"):
                chunks.append(chunk)
        return chunks

    assert asyncio.run(collect()) == ["partial"]


@pytest.mark.parametrize(
    ("provider", "patch_target", "lines"),
    [
        (
            AnthropicProvider("key", "https://anthropic.example", "model"),
            "app.providers.anthropic_provider.httpx.AsyncClient",
            [
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"complete"}}',
                'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
                'data: {"type":"message_stop"}',
            ],
        ),
        (
            OpenAICompatProvider("key", "https://openai.example/v1", "model"),
            "app.providers.openai_compat_provider.httpx.AsyncClient",
            [
                'data: {"choices":[{"delta":{"content":"complete"},"finish_reason":null}]}',
                'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
                "data: [DONE]",
            ],
        ),
    ],
)
def test_provider_streams_accept_explicit_terminal_markers(
    monkeypatch: pytest.MonkeyPatch,
    provider: AnthropicProvider | OpenAICompatProvider,
    patch_target: str,
    lines: list[str],
) -> None:
    requests: list[dict[str, object]] = []
    monkeypatch.setattr(patch_target, fake_async_client(requests, lines=lines))

    async def collect() -> list[str]:
        return [chunk async for chunk in provider.stream("system", "user")]

    assert asyncio.run(collect()) == ["complete"]


@pytest.mark.parametrize(
    ("provider", "patch_target", "lines"),
    [
        (
            AnthropicProvider("key", "https://anthropic.example", "model"),
            "app.providers.anthropic_provider.httpx.AsyncClient",
            [
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}',
                'data: {"type":"message_delta","delta":{"stop_reason":"refusal"}}',
                'data: {"type":"message_stop"}',
            ],
        ),
        (
            OpenAICompatProvider("key", "https://openai.example/v1", "model"),
            "app.providers.openai_compat_provider.httpx.AsyncClient",
            [
                'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}',
                'data: {"choices":[{"delta":{},"finish_reason":"content_filter"}]}',
                "data: [DONE]",
            ],
        ),
    ],
)
def test_provider_streams_classify_safety_rejections(
    monkeypatch: pytest.MonkeyPatch,
    provider: AnthropicProvider | OpenAICompatProvider,
    patch_target: str,
    lines: list[str],
) -> None:
    requests: list[dict[str, object]] = []
    monkeypatch.setattr(patch_target, fake_async_client(requests, lines=lines))

    async def collect() -> list[str]:
        chunks: list[str] = []
        with pytest.raises(ProviderResponseRejectedError):
            async for chunk in provider.stream("system", "user"):
                chunks.append(chunk)
        return chunks

    assert asyncio.run(collect()) == ["partial"]


def test_safety_rejection_maps_to_actionable_safe_error() -> None:
    message = safe_stream_error(
        ProviderResponseRejectedError("secret provider policy details"),
        "fallback",
    )

    assert message == (
        "The AI provider declined this request for safety reasons. "
        "Revise the content and try again."
    )
    assert "secret" not in message
