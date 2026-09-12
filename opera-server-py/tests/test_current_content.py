import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.routes import compose as composer
from app.routes import wechat_compose as wechat
from app.types import CurrentContentModel

CONTEXT = {"title": "当前人工标题", "body": "保留当前人工修订，数字 98765，案例来自用户。", "digest": "当前人工摘要",
           "draftId": "local-draft", "revision": "rev-2"}


class RecordingProvider:
    def __init__(self, target: str, invalid: bool = False):
        self.target = target
        self.invalid = invalid
        self.calls: list[str] = []
        self.streams: list[str] = []

    async def call(self, system: str, user: str) -> str:
        self.calls.append(system + "\n" + user)
        if self.target == "tags":
            return json.dumps({"tags": [] if self.invalid else ["标签"], "imageKeywords": ["配图"]})
        return json.dumps({self.target: "" if self.invalid else "新的内容"})

    async def stream(self, system: str, user: str, **_kwargs):
        self.streams.append(system + "\n" + user)
        yield "" if self.invalid else "新的正文 98765"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as value:
        yield value


def payload(flow: str, target: str) -> dict:
    return {"topic": "这是足够长且有效的当前创作主题", "tone": "knowledge", "targetLength": "short", "regenerate": target,
            ("contentType" if flow == "composer" else "articleType"): "story", "currentContent": CONTEXT.copy()}


def route_for(flow: str):
    return (composer, "/api/compose") if flow == "composer" else (wechat, "/api/wechat/compose")


def events(response) -> list[tuple[str, dict]]:
    name = ""
    result = []
    for line in response.text.splitlines():
        if line.startswith("event: "):
            name = line[7:]
        elif line.startswith("data: "):
            result.append((name, json.loads(line[6:])))
    return result


@pytest.mark.parametrize(("flow", "target"), [
    ("composer", "title"), ("composer", "body"), ("composer", "tags"),
    ("wechat", "title"), ("wechat", "digest"), ("wechat", "body"),
])
def test_current_content_generates_only_target_once(client, monkeypatch, flow, target):
    route, path = route_for(flow)
    provider = RecordingProvider(target)
    monkeypatch.setattr(route, "create_provider", lambda *_a: provider)
    monkeypatch.setattr(route, "is_model_allowed", lambda *_a: True)
    response = client.post(path, json=payload(flow, target))
    assert response.status_code == 200
    output = events(response)
    assert output[0] == ("step", {"step": target})
    assert output[-1] == ("step", {"step": "done"})
    assert all(name in {"step", target} for name, _ in output)
    assert len(provider.calls) == (0 if target == "body" else 1)
    assert len(provider.streams) == (1 if target == "body" else 0)
    prompt = (provider.calls + provider.streams)[0]
    assert CONTEXT["title"] in prompt and CONTEXT["body"] in prompt
    if target != "tags":
        assert CONTEXT["digest"] in prompt
    # Trace IDs are not model instructions or authority tokens.
    assert CONTEXT["draftId"] not in prompt and CONTEXT["revision"] not in prompt


@pytest.mark.parametrize("flow", ["composer", "wechat"])
@pytest.mark.parametrize("bad", [
    "text", [], {}, {"title": "a"}, {"body": "b"}, {"title": 123, "body": "b"},
    {"title": "a", "body": False}, {"title": "a", "body": "   "},
    {"title": "a" * 501, "body": "b"}, {"title": "a", "body": "b" * 20001},
    {**CONTEXT, "digest": "x" * 2001}, {**CONTEXT, "digest": []},
    {**CONTEXT, "draftId": "x" * 129}, {**CONTEXT, "revision": 5},
    {**CONTEXT, "hidden": "unexpected"},
])
def test_rejects_malformed_context_before_provider_creation(client, monkeypatch, flow, bad):
    route, path = route_for(flow)
    def fail_if_called(*_a):
        pytest.fail("Invalid input must not create a provider")
    monkeypatch.setattr(route, "create_provider", fail_if_called)
    response = client.post(path, json={**payload(flow, "title"), "currentContent": bad})
    assert response.status_code == 400
    assert "currentContent" in response.json()["error"]


@pytest.mark.parametrize(("flow", "target"), [("composer", "tags"), ("composer", "body"), ("wechat", "digest")])
def test_invalid_or_empty_candidate_never_emits_done(client, monkeypatch, flow, target):
    route, path = route_for(flow)
    monkeypatch.setattr(route, "create_provider", lambda *_a: RecordingProvider(target, invalid=True))
    monkeypatch.setattr(route, "is_model_allowed", lambda *_a: True)
    output = events(client.post(path, json=payload(flow, target)))
    assert output[-1][0] == "error"
    assert ("step", {"step": "done"}) not in output


def test_accepts_exact_length_limits_and_keeps_tail_context(client, monkeypatch):
    content = {"title": "题" * 500, "body": "文" * 19996 + "末尾事实", "digest": "摘" * 2000,
               "draftId": "d" * 128, "revision": "r" * 128}
    assert len(CurrentContentModel.model_validate(content).body) == 20000
    provider = RecordingProvider("tags")
    monkeypatch.setattr(composer, "create_provider", lambda *_a: provider)
    monkeypatch.setattr(composer, "is_model_allowed", lambda *_a: True)
    output = events(client.post("/api/compose", json={**payload("composer", "tags"), "currentContent": content}))
    assert output[-1] == ("step", {"step": "done"})
    assert "末尾事实" in provider.calls[0]


def test_legacy_tags_request_keeps_old_client_protocol(client, monkeypatch):
    class LegacyProvider:
        def __init__(self):
            self.calls = 0
            self.streams = 0
        async def call(self, _system, _user):
            self.calls += 1
            return [
                json.dumps({"angle": "a", "audience": "a", "hook": "h", "cta": "c", "outline": ["o"], "mustMention": ["m"]}),
                '{"title": "legacy title"}',
                '{"tags": ["tag"], "imageKeywords": ["image"]}',
            ][self.calls - 1]
        async def stream(self, _system, _user, **_kwargs):
            self.streams += 1
            yield "legacy body"
    provider = LegacyProvider()
    monkeypatch.setattr(composer, "create_provider", lambda *_a: provider)
    monkeypatch.setattr(composer, "is_model_allowed", lambda *_a: True)
    request = payload("composer", "tags")
    del request["currentContent"]
    output = events(client.post("/api/compose", json=request))
    assert output[-1] == ("step", {"step": "done"})
    assert provider.calls == 3 and provider.streams == 1
