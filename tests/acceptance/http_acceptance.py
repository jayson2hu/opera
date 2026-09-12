"""Isolated real-process HTTP acceptance with local protocol-compatible model stubs."""

import argparse
import asyncio
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
from urllib.parse import urljoin, urlsplit

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

ROOT = Path(__file__).resolve().parent
# The fixture is also imported from /acceptance in its disposable container.
SOURCE = ROOT.parent.parent / "opera-server-py"
stub = FastAPI()
CALLS = []
FIXTURE_MODELS = {"stub-model", "stub-truncated", "stub-error"}
FIXTURE_MARKER = {
    "fixture": "opera-http-acceptance",
    "version": 1,
    "models": sorted(FIXTURE_MODELS),
}


def answer(system, user):
    if "expert copy editor" in system:
        return "这是经过验收模型桩改写的段落。"
    if "仅重生成：title" in user:
        return json.dumps({"title": "基于当前稿件的候选标题"}, ensure_ascii=False)
    if "仅重生成：digest" in user:
        return json.dumps({"digest": "基于当前稿件的候选摘要"}, ensure_ascii=False)
    if "请理解以下公众号原创选题" in user:
        payload = {
            "angle": "验收角度",
            "audience": "内容创作者",
            "promise": "可复制的流程",
            "outline": ["第一节", "第二节"],
            "keyPoints": ["事实一", "事实二"],
            "cta": "现在试试",
        }
    elif "请理解以下原创创作主题" in user:
        payload = {
            "angle": "验收角度",
            "audience": "内容创作者",
            "hook": "从这里开始",
            "outline": ["第一节", "第二节"],
            "mustMention": ["事实一", "事实二"],
            "cta": "现在试试",
        }
    elif '"coverTitles"' in user:
        payload = {
            "coverTitles": ["标题一", "标题二", "标题三", "标题四", "标题五", "标题六"]
        }
    elif '"cards"' in user:
        payload = {
            "cards": [
                {"type": kind, "content": f"卡片 {index}"}
                for index, kind in enumerate(
                    [
                        "hook",
                        "insight",
                        "insight",
                        "method",
                        "method",
                        "method",
                        "summary",
                    ],
                    1,
                )
            ]
        }
    elif '"caption"' in user:
        payload = {"caption": "这是文章转换后的发布正文。"}
    elif '"tagGroups"' in user:
        payload = {
            "tagGroups": [
                {"type": "broad", "label": "泛流量标签", "tags": ["学习", "成长"]}
            ]
        }
    elif '"imageKeywords"' in user:
        payload = {"tags": ["学习", "写作"], "imageKeywords": ["书桌", "笔记"]}
    elif '"digest"' in user:
        payload = {"digest": "这是文章摘要，介绍写作流程的步骤与实践方法。"}
    elif '"title"' in user:
        payload = {"title": "如何建立可持续的内容写作流程"}
    else:
        payload = {"points": ["观点一", "观点二", "观点三"]}
    return json.dumps(payload, ensure_ascii=False)


async def stream_chunks(protocol, model):
    chunks = [
        "这是通过真实 HTTP 传输的第一段正文。\n\n",
        "这是通过第二个流式事件传输的正文。",
    ]
    if model == "stub-error":
        raise AssertionError("error model must be returned before streaming")
    for chunk in chunks:
        if protocol == "anthropic":
            payload = {
                "type": "content_block_delta",
                "delta": {"type": "text_delta", "text": chunk},
            }
        else:
            payload = {
                "choices": [{"delta": {"content": chunk}, "finish_reason": None}]
            }
        yield "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"
        await asyncio.sleep(0.15)
    reason = "max_tokens" if model == "stub-truncated" else "end_turn"
    if protocol == "anthropic":
        yield (
            "data: "
            + json.dumps({"type": "message_delta", "delta": {"stop_reason": reason}})
            + "\n\n"
        )
        yield 'data: {"type":"message_stop"}\n\n'
    else:
        yield (
            "data: "
            + json.dumps(
                {
                    "choices": [
                        {
                            "delta": {},
                            "finish_reason": "length"
                            if model == "stub-truncated"
                            else "stop",
                        }
                    ]
                }
            )
            + "\n\n"
        )
        yield "data: [DONE]\n\n"


async def respond(request, protocol):
    body = await request.json()
    model = body["model"]
    CALLS.append(
        {
            "protocol": protocol,
            "model": model,
            "stream": body.get("stream", False),
            "max_tokens": body.get("max_tokens"),
        }
    )
    if model == "stub-error":
        return JSONResponse(
            status_code=429, content={"error": "DO_NOT_EXPOSE_STUB_SECRET"}
        )
    if body.get("stream"):
        return StreamingResponse(
            stream_chunks(protocol, model), media_type="text/event-stream"
        )
    messages = body["messages"]
    user = messages[-1]["content"]
    system = body.get("system", messages[0]["content"])
    result = answer(system, user)
    if protocol == "anthropic":
        return {
            "content": [{"type": "text", "text": result}],
            "stop_reason": "end_turn",
        }
    return {"choices": [{"message": {"content": result}, "finish_reason": "stop"}]}


@stub.post("/v1/chat/completions")
async def openai(request: Request):
    return await respond(request, "openai")


@stub.post("/v1/messages")
async def anthropic(request: Request):
    return await respond(request, "anthropic")


@stub.get("/calls")
async def calls():
    return CALLS


@stub.get("/acceptance-fixture")
async def fixture_marker():
    return FIXTURE_MARKER


class FixtureConfigurationError(RuntimeError):
    """Abort safely before issuing any generation request."""


def verify_fixture(client, stub_url):
    """Require an explicit test-only backend configuration and a known fixture."""
    try:
        available = client.get("/api/providers")
        available.raise_for_status()
        payload = available.json()
        providers = {provider["id"]: provider for provider in payload["available"]}
        if payload["default"] != "deepseek":
            raise ValueError("unexpected default")
        for provider_id in ["deepseek", "anthropic", "openai"]:
            models = providers[provider_id]["models"]
            if (
                not isinstance(models, list)
                or len(models) != 3
                or set(models) != FIXTURE_MODELS
            ):
                raise ValueError("unexpected models")
        with httpx.Client(base_url=stub_url, timeout=15, trust_env=False) as fixture:
            marker = fixture.get("/acceptance-fixture")
            marker.raise_for_status()
            if marker.json() != FIXTURE_MARKER:
                raise ValueError("unexpected fixture")
            previous = fixture.get("/calls")
            previous.raise_for_status()
            calls = previous.json()
            if not isinstance(calls, list) or not all(
                isinstance(call, dict)
                and call.get("model") in FIXTURE_MODELS
                and call.get("protocol") in {"openai", "anthropic"}
                and isinstance(call.get("stream"), bool)
                for call in calls
            ):
                raise ValueError("unexpected call log")
        return available, len(calls)
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        raise FixtureConfigurationError(
            "Acceptance fixture validation failed; no generation requests were sent."
        ) from None


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def read_events(response, arrivals=None):
    events = []
    event = None
    for line in response.iter_lines():
        if line.startswith("event: "):
            event = line[7:]
        elif line.startswith("data: "):
            events.append((event, json.loads(line[6:])))
            if arrivals is not None:
                arrivals.append((event, time.monotonic()))
    return events


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url", help="Existing backend or frontend proxy HTTP URL"
    )
    parser.add_argument(
        "--stub-url", help="Existing fixture URL, required with --base-url"
    )
    parser.add_argument(
        "--through-proxy",
        action="store_true",
        help="Allow a proxy to consume X-Accel-Buffering; still verify incremental event delivery",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Dedicated temporary directory for logs and JSON results",
    )
    parser.add_argument("--source", type=Path, default=SOURCE)
    args = parser.parse_args()
    if bool(args.base_url) != bool(args.stub_url):
        parser.error("--base-url and --stub-url must be passed together")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    stub_port, api_port = (None, None) if args.base_url else (free_port(), free_port())
    # Deliberately pass no inherited model credentials or provider URLs.
    env = {
        "PATH": os.environ.get("PATH", ""),
        "LANG": "C.UTF-8",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONPATH": str(args.source),
        "AI_PROVIDER": "deepseek",
        "CORS_ORIGINS": "http://localhost:5173",
        "OPENAI_CHATGPT_MODEL": "stub-model",
    }
    for name in ["DEEPSEEK", "ANTHROPIC", "OPENAI"]:
        env[f"{name}_API_KEY"] = "acceptance-placeholder-key"
        env[f"{name}_BASE_URL"] = f"http://127.0.0.1:{stub_port}"
        env[f"{name}_MODEL"] = "stub-model"
        env[f"{name}_MODELS"] = "stub-model,stub-truncated,stub-error"
    logs = []
    processes = []
    checks = []
    failures = []

    def check(name, condition, detail=None):
        checks.append({"name": name, "passed": bool(condition), "detail": detail})
        if not condition:
            failures.append(name)

    try:
        managed = (
            []
            if args.base_url
            else [
                ("stub", f"{Path(__file__).stem}:stub", stub_port, ROOT),
                ("api", "app.main:app", api_port, args.source),
            ]
        )
        for name, app, port, cwd in managed:
            log = (args.output_dir / f"{name}.log").open("w")
            logs.append(log)
            processes.append(
                subprocess.Popen(
                    [
                        sys.executable,
                        "-m",
                        "uvicorn",
                        app,
                        "--host",
                        "127.0.0.1",
                        "--port",
                        str(port),
                        "--no-access-log",
                    ],
                    cwd=cwd,
                    env=env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                )
            )
        base_url = args.base_url or f"http://127.0.0.1:{api_port}"
        stub_url = args.stub_url or f"http://127.0.0.1:{stub_port}"
        with httpx.Client(base_url=base_url, timeout=15, trust_env=False) as client:
            for _ in range(100):
                try:
                    if client.get("/api/health").status_code == 200:
                        break
                except httpx.ConnectError:
                    pass
                time.sleep(0.05)
            else:
                raise RuntimeError("Backend did not become healthy")
            check("health", client.get("/api/health").json()["status"] == "ok")
            check(
                "not_found",
                client.get("/api/not-found").json() == {"error": "Not found"},
            )
            try:
                available, call_start = verify_fixture(client, stub_url)
            except FixtureConfigurationError as exc:
                print(str(exc), file=sys.stderr)
                return 1
            check(
                "providers_no_secrets",
                available.status_code == 200
                and "acceptance-placeholder-key" not in available.text,
            )
            if args.through_proxy:
                page = client.get("/")
                check(
                    "frontend_html",
                    page.status_code == 200
                    and page.headers.get("content-type", "").startswith("text/html")
                    and "<html" in page.text.lower(),
                )
                scripts = re.findall(
                    r'<script\b[^>]*\bsrc=["\']([^"\']+)', page.text, re.IGNORECASE
                )
                origin = urlsplit(base_url)
                script_urls = [urljoin(str(page.url), script) for script in scripts]
                local_scripts = [
                    url
                    for url in script_urls
                    if (urlsplit(url).scheme, urlsplit(url).netloc)
                    == (origin.scheme, origin.netloc)
                ]
                script = client.get(local_scripts[0]) if local_scripts else None
                check(
                    "frontend_javascript",
                    script is not None
                    and script.status_code == 200
                    and "javascript" in script.headers.get("content-type", "")
                    and bool(script.content),
                )
            for origin, allowed in [
                ("http://localhost:5173", True),
                ("https://attacker.example", False),
            ]:
                response = client.options(
                    "/api/compose",
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "POST",
                        "Access-Control-Request-Headers": "content-type",
                    },
                )
                check(
                    f"cors_{allowed}",
                    response.status_code == (200 if allowed else 400)
                    and (response.headers.get("access-control-allow-origin") == origin)
                    == allowed,
                )
            endpoints = [
                "/api/generate",
                "/api/generate/continue",
                "/api/compose",
                "/api/wechat/compose",
                "/api/rewrite-paragraph",
            ]
            for endpoint in endpoints:
                for name, body in [
                    ("broken_json", b"{"),
                    ("array_json", b"[]"),
                    ("invalid_utf8", b"\xff"),
                ]:
                    response = client.post(
                        endpoint,
                        content=body,
                        headers={
                            "Content-Type": "application/json",
                            "Connection": "close",
                        },
                    )
                    check(
                        f"{endpoint}:{name}",
                        response.status_code == 400,
                        {"status": response.status_code, "body": response.text},
                    )
            base = {
                "topic": "这是验证内容创作工作流的完整验收选题",
                "tone": "knowledge",
                "targetLength": "long",
                "provider": "deepseek",
                "model": "stub-model",
            }
            for provider in ["deepseek", "anthropic", "openai"]:
                for endpoint, kind in [
                    ("/api/compose", {"contentType": "knowledge"}),
                    ("/api/wechat/compose", {"articleType": "guide"}),
                ]:
                    arrivals = []
                    with client.stream(
                        "POST", endpoint, json=base | kind | {"provider": provider}
                    ) as response:
                        events = read_events(response, arrivals)
                    check(
                        f"{provider}:{endpoint}:full_flow",
                        response.status_code == 200
                        and events[-1] == ("step", {"step": "done"})
                        and sum(event == "body" for event, _ in events) == 2
                        and not any(event == "error" for event, _ in events),
                        events,
                    )
                    check(
                        f"{provider}:{endpoint}:sse_headers",
                        response.headers["content-type"].startswith("text/event-stream")
                        and (
                            args.through_proxy
                            or response.headers.get("x-accel-buffering") == "no"
                        ),
                    )
                    body_times = [
                        arrived for event, arrived in arrivals if event == "body"
                    ]
                    check(
                        f"{provider}:{endpoint}:incremental_stream",
                        len(body_times) == 2 and body_times[1] - body_times[0] >= 0.07,
                        body_times,
                    )
                    for model in ["stub-truncated", "stub-error"]:
                        response = client.post(
                            endpoint,
                            json=base | kind | {"provider": provider, "model": model},
                        )
                        events = read_events(response)
                        check(
                            f"{provider}:{endpoint}:{model}",
                            events[-1][0] == "error"
                            and ("step", {"step": "done"}) not in events
                            and "DO_NOT_EXPOSE" not in response.text,
                            events,
                        )
                generated = client.post(
                    "/api/generate",
                    json={
                        "text": "验收来源文章：有效的内容整理可以帮助创作者提升工作效率。",
                        "tone": "knowledge",
                        "provider": provider,
                        "model": "stub-model",
                    },
                )
                extracted = read_events(generated)
                points = next(
                    payload["points"]
                    for event, payload in extracted
                    if event == "extraction_points"
                )
                check(
                    f"{provider}:generate_pause",
                    extracted[-1] == ("step", {"step": "paused"}),
                )
                continued = client.post(
                    "/api/generate/continue",
                    json={
                        "text": "验收来源文章：有效的内容整理可以帮助创作者提升工作效率。",
                        "tone": "knowledge",
                        "provider": provider,
                        "model": "stub-model",
                        "points": points,
                    },
                )
                events = read_events(continued)
                check(
                    f"{provider}:generate_continue",
                    events[-1] == ("step", {"step": "done"})
                    and {"titles", "cards", "cards_v2", "caption", "tags"}.issubset(
                        {event for event, _ in events}
                    ),
                    events,
                )
                rewritten = client.post(
                    "/api/rewrite-paragraph",
                    json={
                        "text": "原来的段落",
                        "instruction": "更清晰",
                        "provider": provider,
                        "model": "stub-model",
                    },
                )
                check(
                    f"{provider}:rewrite",
                    rewritten.status_code == 200
                    and "改写" in rewritten.json().get("text", ""),
                )
            current = {
                "title": "我的现稿",
                "body": "这是人工编辑后保留的内容。",
                "digest": "现有摘要",
                "draftId": "acceptance-draft",
                "revision": "revision-1",
            }
            for endpoint, kind, targets in [
                (
                    "/api/compose",
                    {"contentType": "knowledge"},
                    ["title", "body", "tags"],
                ),
                (
                    "/api/wechat/compose",
                    {"articleType": "guide"},
                    ["title", "digest", "body"],
                ),
            ]:
                for target in targets:
                    response = client.post(
                        endpoint,
                        json=base
                        | kind
                        | {"regenerate": target, "currentContent": current},
                    )
                    events = read_events(response)
                    check(
                        f"{endpoint}:current_{target}",
                        events[-1] == ("step", {"step": "done"})
                        and all(event in {"step", target} for event, _ in events),
                        events,
                    )
            bad_model = client.post(
                "/api/compose",
                json=base
                | {"contentType": "knowledge", "model": "unapproved-premium-model"},
            )
            check("model_allowlist", bad_model.status_code == 400)
            recorded = httpx.get(
                f"{stub_url.rstrip('/')}/calls", trust_env=False
            ).json()[call_start:]
            check(
                "long_output_budget",
                all(call["max_tokens"] == 4096 for call in recorded if call["stream"]),
            )
            result = {
                "checks": checks,
                "total": len(checks),
                "passed": len(checks) - len(failures),
                "failures": failures,
                "provider_calls": len(recorded),
                "urls": {"api": base_url, "stub": stub_url},
            }
            (args.output_dir / "http-results.json").write_text(
                json.dumps(result, ensure_ascii=False, indent=2)
            )
            print(
                json.dumps(
                    {
                        key: result[key]
                        for key in [
                            "total",
                            "passed",
                            "failures",
                            "provider_calls",
                            "urls",
                        ]
                    },
                    ensure_ascii=False,
                )
            )
    finally:
        for process in reversed(processes):
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        for log in logs:
            log.close()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
