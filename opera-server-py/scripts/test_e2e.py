from __future__ import annotations

import json
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_GENERATE_EVENTS = [
    ("step", {"step": "extracting"}),
    ("step", {"step": "titles"}),
    ("titles", None),
    ("step", {"step": "cards"}),
    ("cards", None),
    ("step", {"step": "caption"}),
    ("caption", None),
    ("step", {"step": "tags"}),
    ("tags", None),
    ("step", {"step": "done"}),
]
EXPECTED_WECHAT_STEPS = ["extracting", "title", "digest", "body", "done"]


def pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        sock.listen(1)
        return int(sock.getsockname()[1])


def wait_until_ready(base_url: str, timeout_seconds: float = 20.0) -> None:
    deadline = time.time() + timeout_seconds
    with httpx.Client(timeout=2.0) as client:
        while time.time() < deadline:
            try:
                response = client.get(f"{base_url}/api/health")
                if response.status_code == 200:
                    return
            except Exception:
                pass
            time.sleep(0.5)
    raise RuntimeError("FastAPI server did not become ready in time")


def parse_sse_lines(lines: list[str]) -> list[tuple[str, dict[str, object]]]:
    events: list[tuple[str, dict[str, object]]] = []
    event_name = ""
    for line in lines:
        if not line:
            continue
        if line.startswith("event: "):
            event_name = line[7:].strip()
        elif line.startswith("data: ") and event_name:
            events.append((event_name, json.loads(line[6:])))
            event_name = ""
    return events


def main() -> None:
    port = pick_free_port()
    base_url = f"http://127.0.0.1:{port}"
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        wait_until_ready(base_url)
        with httpx.Client(timeout=180.0) as client:
            health = client.get(f"{base_url}/api/health")
            assert health.status_code == 200
            health_payload = health.json()
            assert health_payload["status"] == "ok"
            assert isinstance(health_payload["timestamp"], str)
            print("[PASS] GET /api/health")

            providers = client.get(f"{base_url}/api/providers")
            assert providers.status_code == 200
            providers_payload = providers.json()
            assert "default" in providers_payload
            assert "available" in providers_payload
            assert providers_payload["available"]
            print("[PASS] GET /api/providers")

            empty_body = client.post(f"{base_url}/api/generate", json={})
            assert empty_body.status_code == 400
            assert empty_body.json() == {"error": "text is required and must be non-empty"}
            print("[PASS] POST /api/generate empty body")

            invalid_tone = client.post(
                f"{base_url}/api/generate",
                json={"text": "hello", "tone": "bad"},
            )
            assert invalid_tone.status_code == 400
            assert invalid_tone.json() == {"error": "tone must be one of: knowledge, casual, bff"}
            print("[PASS] POST /api/generate invalid tone")

            invalid_provider = client.post(
                f"{base_url}/api/generate",
                json={"text": "hello", "tone": "knowledge", "provider": "bad"},
            )
            assert invalid_provider.status_code == 400
            assert invalid_provider.json() == {"error": "provider must be one of: anthropic, deepseek, custom"}
            print("[PASS] POST /api/generate invalid provider")

            sample_text = (
                "高效阅读的三个方法。第一，带着问题读书，在翻开书之前先写下三个你最想解决的问题，"
                "这样你的大脑就会自动过滤无用信息。第二，用自己的话复述，每读完一个章节合上书用30秒"
                "复述核心观点，说不出来的地方就是你还没真正理解的地方。第三，建立知识连接，把新学到"
                "的概念和你已有的知识做关联，连接越多记忆越牢。实践建议：不要贪多，一周精读一本比泛读"
                "五本更有效。读完后写一段200字的读书笔记，三个月后你会感谢现在的自己。"
            )
            with client.stream(
                "POST",
                f"{base_url}/api/generate",
                json={"text": sample_text, "tone": "knowledge"},
            ) as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers["content-type"]
                lines = [line for line in response.iter_lines()]
            events = parse_sse_lines(lines)
            assert len(events) == 10
            for index, (name, payload) in enumerate(events):
                expected_name, expected_payload = EXPECTED_GENERATE_EVENTS[index]
                assert name == expected_name
                if expected_payload is not None:
                    assert payload == expected_payload
            assert isinstance(events[2][1]["coverTitles"], list)
            assert isinstance(events[4][1]["cards"], list)
            assert isinstance(events[6][1]["caption"], str)
            assert isinstance(events[8][1]["tagGroups"], list)
            print("[PASS] POST /api/generate real-key SSE")
            print(f"[PASS] Generate SSE events: {len(events)}")

            compose_invalid = client.post(
                f"{base_url}/api/compose",
                json={
                    "topic": "太短",
                    "contentType": "story",
                    "tone": "knowledge",
                    "targetLength": "short",
                },
            )
            assert compose_invalid.status_code == 400
            assert compose_invalid.json() == {"error": "topic must be 10-500 characters"}
            print("[PASS] POST /api/compose invalid topic")

            with client.stream(
                "POST",
                f"{base_url}/api/compose",
                json={
                    "topic": "分享我用番茄工作法戒掉拖延症的经历，实测三个月有效，也想把方法写给总是拖延的人",
                    "contentType": "story",
                    "tone": "knowledge",
                    "targetLength": "medium",
                },
            ) as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers["content-type"]
                lines = [line for line in response.iter_lines()]
            compose_events = parse_sse_lines(lines)
            assert compose_events[0] == ("step", {"step": "extracting"})
            assert compose_events[1] == ("step", {"step": "title"})
            assert compose_events[2][0] == "title"
            assert isinstance(compose_events[2][1]["title"], str)
            assert compose_events[3] == ("step", {"step": "body"})

            tag_step_index = next(
                index
                for index, (name, payload) in enumerate(compose_events)
                if name == "step" and payload.get("step") == "tags"
            )
            body_events = compose_events[4:tag_step_index]
            assert body_events
            assert all(name == "body" for name, _ in body_events)
            assert all(isinstance(payload["body"], str) for _, payload in body_events)
            assert compose_events[tag_step_index + 1][0] == "tags"
            assert isinstance(compose_events[tag_step_index + 1][1]["tags"], list)
            assert isinstance(compose_events[tag_step_index + 1][1]["imageKeywords"], list)
            assert compose_events[-1] == ("step", {"step": "done"})
            print("[PASS] POST /api/compose real-key SSE")
            print(f"[PASS] Compose SSE events: {len(compose_events)}")

            wechat_invalid = client.post(
                f"{base_url}/api/wechat/compose",
                json={
                    "topic": "太短",
                    "articleType": "guide",
                    "tone": "knowledge",
                    "targetLength": "medium",
                },
            )
            assert wechat_invalid.status_code == 400
            assert wechat_invalid.json() == {"error": "topic must be 12-500 characters"}
            print("[PASS] POST /api/wechat/compose invalid topic")

            with client.stream(
                "POST",
                f"{base_url}/api/wechat/compose",
                json={
                    "topic": "写一篇关于 AI 改造公众号工作流的完整复盘，重点讲选题、摘要和正文协作方式，以及我自己的实践经验。",
                    "articleType": "guide",
                    "tone": "knowledge",
                    "targetLength": "long",
                },
            ) as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers["content-type"]
                lines = [line for line in response.iter_lines()]
            wechat_events = parse_sse_lines(lines)
            assert [payload["step"] for name, payload in wechat_events if name == "step"] == EXPECTED_WECHAT_STEPS
            assert wechat_events[2][0] == "title"
            assert isinstance(wechat_events[2][1]["title"], str)
            assert wechat_events[4][0] == "digest"
            assert isinstance(wechat_events[4][1]["digest"], str)
            body_events = [payload for name, payload in wechat_events if name == "body"]
            assert body_events
            assert all(isinstance(payload["body"], str) and payload["body"].strip() for payload in body_events)
            assert wechat_events[-1] == ("step", {"step": "done"})
            print("[PASS] POST /api/wechat/compose real-key SSE")
            print(f"[PASS] WeChat SSE events: {len(wechat_events)}")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        if process.stdout:
            output = process.stdout.read().strip()
            if output:
                print("\n=== Server output ===")
                print(output)


if __name__ == "__main__":
    main()
