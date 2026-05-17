import json
import os
from collections.abc import Iterator

from fastapi.testclient import TestClient
import pytest

os.environ.setdefault("AI_PROVIDER", "deepseek")
os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")
os.environ.setdefault("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
os.environ.setdefault("DEEPSEEK_MODEL", "deepseek-chat")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("ANTHROPIC_MODELS", "claude-sonnet-4-20250514,claude-haiku-4-5")
os.environ.setdefault("ANTHROPIC_COMPAT_API_KEY", "test-anthropic-compat-key")
os.environ.setdefault("ANTHROPIC_COMPAT_BASE_URL", "https://claude-gateway.example.com")
os.environ.setdefault("ANTHROPIC_COMPAT_MODEL", "claude-third-party")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
os.environ.setdefault("OPENAI_MODEL", "gpt-5.2")
os.environ.setdefault("OPENAI_CHATGPT_MODEL", "gpt-5.2-chat-latest")
os.environ.setdefault("OPENAI_COMPAT_API_KEY", "test-openai-compat-key")
os.environ.setdefault("OPENAI_COMPAT_BASE_URL", "https://openai-gateway.example.com/v1")
os.environ.setdefault("OPENAI_COMPAT_MODEL", "gpt-third-party")
os.environ.setdefault("CUSTOM_API_KEY", "test-custom-key")
os.environ.setdefault("CUSTOM_BASE_URL", "https://example.com/v1")
os.environ.setdefault("CUSTOM_MODEL", "gpt-4o")

from app.config import VALID_PROVIDER_VALUES, Settings, get_settings
from app.main import create_app
from app.providers.anthropic_provider import AnthropicProvider
from app.providers.factory import create_provider, get_available_providers
from app.providers.openai_compat_provider import OpenAICompatProvider
from app.routes import compose as compose_route
from app.routes import generate as generate_route
from app.routes import wechat_compose as wechat_compose_route


class FakeGenerateProvider:
    prompt_history: list[str] = []

    async def call(self, _system: str, user: str) -> str:
        self.__class__.prompt_history.append(user)
        if "封面标题" in user:
            return '{"coverTitles": ["标题1", "标题2", "标题3", "标题4"]}'
        if "发布正文" in user or "正文文案内容" in user:
            return '{"caption": "正文文案"}'
        if "图文卡片" in user:
            return '{"cards": ["卡片1", "卡片2", "卡片3", "卡片4", "卡片5"]}'
        if "标签" in user:
            return '{"tagGroups": [{"type": "broad", "label": "泛流量标签", "tags": ["自我提升", "学习方法"]}]}'
        return '{"points": ["观点1", "观点2", "观点3"]}'



class FakeComposeProvider:
    def __init__(self) -> None:
        self.call_index = 0

    async def call(self, _system: str, _user: str) -> str:
        responses = [
            '{"angle": "反拖延实测复盘", "audience": "效率焦虑的上班族", "hook": "我用番茄工作法把拖延打掉了", "outline": ["先说我为什么总拖延", "番茄工作法怎么真正落地", "3个月后我有哪些变化"], "mustMention": ["3个月实测有效", "每天先从25分钟开始"], "cta": "如果你也总是拖到最后，不妨今晚先试一个番茄钟"}',
            '{"title": "我用番茄工作法戒掉拖延了"}',
            '{"tags": ["效率提升", "拖延症", "番茄工作法"], "imageKeywords": ["效率工具", "番茄工作法", "时间管理"]}',
        ]
        response = responses[min(self.call_index, len(responses) - 1)]
        self.call_index += 1
        return response

    async def stream(self, _system: str, _user: str):
        yield "这是流式"
        yield "正文"


class FakeWeChatProvider:
    async def call(self, _system: str, user: str) -> str:
        if "请理解以下公众号原创选题" in user:
            return (
                '{"angle": "用真实案例拆解 AI 提效流程", '
                '"audience": "需要稳定输出公众号文章的内容创作者", '
                '"promise": "帮助读者建立可复制的公众号写作工作流", '
                '"outline": ["先解释为什么公众号写作越来越难", "再拆解 AI 如何介入选题和结构", "最后给出可直接照搬的执行步骤"], '
                '"keyPoints": ["标题和摘要的职责不同", "正文必须保留个人经验与判断"], '
                '"cta": "如果你也在写公众号，不妨先用一篇旧选题试试这套流程"}'
            )
        if "生成 1 个适合公众号发布的标题" in user:
            return '{"title": "我用 AI 重做公众号写作流程后，效率真的变高了"}'
        if "生成一段适合作为公众号摘要或导语的文案" in user:
            return '{"digest": "这篇文章会拆解我如何用 AI 重做公众号写作流程，并总结出一套可复制的提效步骤。"}'
        raise AssertionError(f"Unexpected prompt: {user[:80]}")

    async def stream(self, _system: str, _user: str):
        yield "第一段正文\n\n"
        yield "第二段正文"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    get_settings.cache_clear()
    FakeGenerateProvider.prompt_history = []
    monkeypatch.setattr(generate_route, "create_provider", lambda *_args, **_kwargs: FakeGenerateProvider())
    monkeypatch.setattr(compose_route, "create_provider", lambda *_args, **_kwargs: FakeComposeProvider())
    monkeypatch.setattr(wechat_compose_route, "create_provider", lambda *_args, **_kwargs: FakeWeChatProvider())
    with TestClient(create_app()) as test_client:
        yield test_client



def test_health_contract(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert isinstance(payload["timestamp"], str)


def test_providers_contract(client: TestClient) -> None:
    response = client.get("/api/providers")
    assert response.status_code == 200
    payload = response.json()
    assert payload["default"] == "deepseek"
    assert any(item["id"] == "deepseek" for item in payload["available"])
    assert any(item["id"] == "anthropic_compat" for item in payload["available"])
    assert any(item["id"] == "openai" for item in payload["available"])
    assert any(item["id"] == "openai_compat" for item in payload["available"])


def test_generate_empty_body_returns_400(client: TestClient) -> None:
    response = client.post("/api/generate", json={})
    assert response.status_code == 400
    assert response.json() == {"error": "text is required and must be non-empty"}


def test_generate_invalid_tone_returns_400(client: TestClient) -> None:
    response = client.post("/api/generate", json={"text": "hello", "tone": "bad"})
    assert response.status_code == 400
    assert response.json() == {"error": "tone must be one of: knowledge, casual, bff"}


def test_generate_invalid_provider_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/generate",
        json={"text": "hello", "tone": "knowledge", "provider": "bad"},
    )
    assert response.status_code == 400
    assert response.json() == {"error": f"provider must be one of: {', '.join(VALID_PROVIDER_VALUES)}"}


def test_provider_model_lists_and_names() -> None:
    settings = Settings(
        ai_provider="openai",
        anthropic_api_key="anthropic-key",
        anthropic_models="claude-a, claude-b, claude-a",
        anthropic_compat_api_key="anthropic-compat-key",
        anthropic_compat_base_url="https://claude.example.com",
        anthropic_compat_model="claude-third-party",
        openai_api_key="openai-key",
        openai_models="gpt-a, gpt-b, gpt-a",
        openai_compat_api_key="openai-compat-key",
        openai_compat_base_url="https://openai.example.com/v1",
        openai_compat_model="gpt-third-party",
        deepseek_api_key="deepseek-key",
        custom_api_key="custom-key",
        custom_base_url="https://custom.example.com/v1",
        custom_model="custom-model",
    )

    payload = get_available_providers(settings)
    providers = {item["id"]: item for item in payload["available"]}

    assert payload["default"] == "openai"
    assert providers["anthropic"]["name"] == "Claude official"
    assert providers["anthropic"]["models"] == ["claude-a", "claude-b", "claude-sonnet-4-20250514"]
    assert providers["anthropic_compat"]["name"] == "Claude third-party"
    assert providers["openai"]["name"] == "ChatGPT / OpenAI official"
    assert providers["openai"]["models"] == ["gpt-a", "gpt-b", "gpt-5.2", "gpt-5.2-chat-latest"]
    assert providers["openai_compat"]["name"] == "ChatGPT / OpenAI third-party"
    assert providers["custom"]["name"] == "Custom (Legacy)"


def test_provider_factory_supports_official_and_third_party_protocols() -> None:
    settings = Settings(
        anthropic_api_key="anthropic-key",
        anthropic_model="claude-official",
        anthropic_compat_api_key="anthropic-compat-key",
        anthropic_compat_base_url="https://claude.example.com",
        anthropic_compat_model="claude-third-party",
        openai_api_key="openai-key",
        openai_model="gpt-official",
        openai_compat_api_key="openai-compat-key",
        openai_compat_base_url="https://openai.example.com/v1",
        openai_compat_model="gpt-third-party",
    )

    assert isinstance(create_provider(settings, "anthropic"), AnthropicProvider)
    assert isinstance(create_provider(settings, "anthropic_compat"), AnthropicProvider)
    assert isinstance(create_provider(settings, "openai"), OpenAICompatProvider)
    assert isinstance(create_provider(settings, "openai_compat"), OpenAICompatProvider)


def test_provider_factory_requires_third_party_base_urls() -> None:
    anthropic_settings = Settings(
        anthropic_compat_api_key="anthropic-compat-key",
        anthropic_compat_base_url="",
        anthropic_compat_model="claude-third-party",
    )
    openai_settings = Settings(
        openai_compat_api_key="openai-compat-key",
        openai_compat_base_url="",
        openai_compat_model="gpt-third-party",
    )

    with pytest.raises(RuntimeError, match="ANTHROPIC_COMPAT_BASE_URL"):
        create_provider(anthropic_settings, "anthropic_compat")
    with pytest.raises(RuntimeError, match="OPENAI_COMPAT_BASE_URL"):
        create_provider(openai_settings, "openai_compat")


def test_generate_invalid_target_length_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/generate",
        json={"text": "hello", "tone": "knowledge", "targetLength": "bad"},
    )
    assert response.status_code == 400
    assert response.json() == {"error": "targetLength must be one of: short, medium, long"}


def test_generate_preprocesses_wechat_artifacts(client: TestClient) -> None:
    FakeGenerateProvider.prompt_history = []
    with client.stream(
        "POST",
        "/api/generate",
        json={
            "text": "<p>点击上方蓝字关注我们</p><p>这是正文第一段。</p><p>第二段继续展开。</p><p>阅读原文</p>",
            "tone": "knowledge",
        },
    ) as response:
        assert response.status_code == 200
        list(response.iter_lines())

    assert FakeGenerateProvider.prompt_history
    first_prompt = FakeGenerateProvider.prompt_history[0]
    assert "点击上方蓝字关注我们" not in first_prompt
    assert "阅读原文" not in first_prompt
    assert "<p>" not in first_prompt
    assert "这是正文第一段。" in first_prompt
    assert "第二段继续展开。" in first_prompt



def test_generate_sse_contract(client: TestClient) -> None:

    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/generate",
        json={"text": "高效阅读的三个方法", "tone": "knowledge"},
    ) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == [
        "step",
        "extraction_points",
        "step",
    ]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "paused",
    ]
    assert events[1][1]["points"] == ["观点1", "观点2", "观点3"]


def test_generate_continue_sse_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/generate/continue",
        json={
            "text": "高效阅读的三个方法",
            "tone": "knowledge",
            "points": ["观点1", "观点2", "观点3"],
        },
    ) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == [
        "step",
        "titles",
        "step",
        "cards",
        "step",
        "caption",
        "step",
        "tags",
        "step",
    ]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "titles",
        "cards",
        "caption",
        "tags",
        "done",
    ]
    assert events[1][1]["coverTitles"] == ["标题1", "标题2", "标题3", "标题4"]
    assert events[3][1]["cards"] == ["卡片1", "卡片2", "卡片3", "卡片4", "卡片5"]
    assert events[5][1]["caption"] == "正文文案"
    assert events[7][1]["tagGroups"][0]["type"] == "broad"


def test_generate_continue_requires_valid_points(client: TestClient) -> None:
    response = client.post(
        "/api/generate/continue",
        json={"text": "高效阅读的三个方法", "tone": "knowledge", "points": ["观点1", "观点2"]},
    )

    assert response.status_code == 400
    assert response.json() == {"error": "points must contain 3-8 items"}


def test_compose_invalid_topic_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/compose",
        json={
            "topic": "太短",
            "contentType": "story",
            "tone": "knowledge",
            "targetLength": "short",
        },
    )
    assert response.status_code == 400
    assert response.json() == {"error": "topic must be 10-500 characters"}


def test_compose_invalid_regenerate_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/compose",
        json={
            "topic": "分享我用番茄工作法戒掉拖延症的经历",
            "contentType": "story",
            "tone": "knowledge",
            "targetLength": "short",
            "regenerate": "bad",
        },
    )
    assert response.status_code == 400
    assert response.json() == {"error": "regenerate must be one of: title, body, tags"}


def test_compose_sse_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/compose",
        json={
            "topic": "分享我用番茄工作法戒掉拖延症的经历，实测三个月有效",
            "contentType": "story",
            "tone": "knowledge",
            "targetLength": "medium",
        },
    ) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == [
        "step",
        "step",
        "title",
        "step",
        "body",
        "body",
        "step",
        "tags",
        "step",
    ]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "title",
        "body",
        "tags",
        "done",
    ]
    assert events[2][1]["title"] == "我用番茄工作法戒掉拖延了"
    assert events[4][1]["body"] == "这是流式"
    assert events[5][1]["body"] == "这是流式正文"
    assert events[7][1]["tags"] == ["效率提升", "拖延症", "番茄工作法"]
    assert events[7][1]["imageKeywords"] == ["效率工具", "番茄工作法", "时间管理"]


def test_compose_regenerate_title_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/compose",
        json={
            "topic": "分享我用番茄工作法戒掉拖延症的经历，实测三个月有效",
            "contentType": "story",
            "tone": "knowledge",
            "targetLength": "medium",
            "regenerate": "title",
        },
    ) as response:
        assert response.status_code == 200
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == ["step", "step", "title", "step"]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "title",
        "done",
    ]
    assert events[2][1]["title"] == "我用番茄工作法戒掉拖延了"


def test_compose_regenerate_body_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/compose",
        json={
            "topic": "分享我用番茄工作法戒掉拖延症的经历，实测三个月有效",
            "contentType": "story",
            "tone": "knowledge",
            "targetLength": "medium",
            "regenerate": "body",
        },
    ) as response:
        assert response.status_code == 200
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == ["step", "step", "body", "body", "step"]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "body",
        "done",
    ]
    assert events[2][1]["body"] == "这是流式"
    assert events[3][1]["body"] == "这是流式正文"


def test_compose_regenerate_tags_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/compose",
        json={
            "topic": "分享我用番茄工作法戒掉拖延症的经历，实测三个月有效",
            "contentType": "story",
            "tone": "knowledge",
            "targetLength": "medium",
            "regenerate": "tags",
        },
    ) as response:
        assert response.status_code == 200
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == ["step", "step", "tags", "step"]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "tags",
        "done",
    ]
    assert events[2][1]["tags"] == ["效率提升", "拖延症", "番茄工作法"]
    assert events[2][1]["imageKeywords"] == ["效率工具", "番茄工作法", "时间管理"]


def test_wechat_compose_invalid_topic_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/wechat/compose",
        json={
            "topic": "太短",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "medium",
        },
    )
    assert response.status_code == 400
    assert response.json() == {"error": "topic must be 12-500 characters"}


def test_wechat_compose_invalid_article_type_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/wechat/compose",
        json={
            "topic": "写一篇关于 AI 改造公众号工作流的完整复盘",
            "articleType": "bad",
            "tone": "knowledge",
            "targetLength": "medium",
        },
    )
    assert response.status_code == 400
    assert response.json() == {"error": "articleType must be one of: insight, guide, story, briefing"}


def test_wechat_compose_invalid_regenerate_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/wechat/compose",
        json={
            "topic": "写一篇关于 AI 改造公众号工作流的完整复盘",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "medium",
            "regenerate": "bad",
        },
    )
    assert response.status_code == 400
    assert response.json() == {"error": "regenerate must be one of: title, digest, body"}


def test_wechat_compose_sse_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/wechat/compose",
        json={
            "topic": "写一篇关于 AI 改造公众号工作流的完整复盘，重点讲选题、摘要和正文协作方式",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "long",
        },
    ) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == [
        "step",
        "step",
        "title",
        "step",
        "digest",
        "step",
        "body",
        "body",
        "step",
    ]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "title",
        "digest",
        "body",
        "done",
    ]
    assert events[2][1]["title"] == "我用 AI 重做公众号写作流程后，效率真的变高了"
    assert events[4][1]["digest"] == "这篇文章会拆解我如何用 AI 重做公众号写作流程，并总结出一套可复制的提效步骤。"
    assert events[6][1]["body"] == "第一段正文\n\n"
    assert events[7][1]["body"] == "第一段正文\n\n第二段正文"


def test_wechat_compose_regenerate_title_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/wechat/compose",
        json={
            "topic": "写一篇关于 AI 改造公众号工作流的完整复盘，重点讲选题、摘要和正文协作方式",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "medium",
            "regenerate": "title",
        },
    ) as response:
        assert response.status_code == 200
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == ["step", "step", "title", "step"]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "title",
        "done",
    ]
    assert events[2][1]["title"] == "我用 AI 重做公众号写作流程后，效率真的变高了"


def test_wechat_compose_regenerate_digest_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/wechat/compose",
        json={
            "topic": "写一篇关于 AI 改造公众号工作流的完整复盘，重点讲选题、摘要和正文协作方式",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "medium",
            "regenerate": "digest",
        },
    ) as response:
        assert response.status_code == 200
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == ["step", "step", "digest", "step"]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "digest",
        "done",
    ]
    assert events[2][1]["digest"] == "这篇文章会拆解我如何用 AI 重做公众号写作流程，并总结出一套可复制的提效步骤。"


def test_wechat_compose_regenerate_body_contract(client: TestClient) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    with client.stream(
        "POST",
        "/api/wechat/compose",
        json={
            "topic": "写一篇关于 AI 改造公众号工作流的完整复盘，重点讲选题、摘要和正文协作方式",
            "articleType": "guide",
            "tone": "knowledge",
            "targetLength": "medium",
            "regenerate": "body",
        },
    ) as response:
        assert response.status_code == 200
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: ") and event_name:
                events.append((event_name, json.loads(line[6:])))
                event_name = ""

    assert [name for name, _ in events] == ["step", "step", "body", "body", "step"]
    assert [payload["step"] for name, payload in events if name == "step"] == [
        "extracting",
        "body",
        "done",
    ]
    assert events[2][1]["body"] == "第一段正文\n\n"
    assert events[3][1]["body"] == "第一段正文\n\n第二段正文"
