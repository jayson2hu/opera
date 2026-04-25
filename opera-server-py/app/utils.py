import html
import json
import re

_BLOCK_BREAK_RE = re.compile(
    r"</?(?:article|aside|blockquote|br|div|figcaption|figure|h[1-6]|header|li|ol|p|section|table|tr|ul)[^>]*>",
    re.IGNORECASE,
)
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_URL_ONLY_RE = re.compile(r"^(?:https?://|www\.)\S+$", re.IGNORECASE)
_BOILERPLATE_LINE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"^(?:原标题|原文链接)[:：]?.*$",
        r"^(?:作者|来源|编辑|责编|责任编辑|校对|审核|撰文)[:：]?.*$",
        r"^(?:点击上方.*(?:关注|蓝字)|关注(?:我?们|公众号)|欢迎(?:留言|转发|分享|关注)).*$",
        r"^(?:长按.*(?:二维码|识别)|扫码.*(?:关注|添加)|微信扫一扫.*(?:关注|添加)).*$",
        r"^(?:推荐阅读|相关阅读|延伸阅读|往期推荐).*$",
        r"^(?:阅读原文|继续滑动看下一个|收藏|点赞|分享|在看).*$",
        r"^(?:免责声明|版权声明|商务合作|投稿|联系我们).*$",
        r"^(?:本文(?:转载自|来源于)|更多精彩内容请关注).*$",
    )
]


def extract_json(raw: str):
    cleaned = raw.strip()
    decoder = json.JSONDecoder()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        return decoder.decode(cleaned)
    except json.JSONDecodeError:
        pass

    for index, char in enumerate(cleaned):
        if char not in "[{":
            continue
        try:
            parsed, _ = decoder.raw_decode(cleaned[index:])
            return parsed
        except json.JSONDecodeError:
            continue

    raise json.JSONDecodeError("No JSON object found", cleaned, 0)


def preprocess_article_text(raw: str) -> str:
    normalized = html.unescape(raw.replace("\r\n", "\n").replace("\r", "\n"))
    normalized = normalized.replace("\u00a0", " ").replace("\u200b", "")
    normalized = _BLOCK_BREAK_RE.sub("\n", normalized)
    normalized = _HTML_TAG_RE.sub("", normalized)

    cleaned_lines: list[str] = []
    for raw_line in normalized.split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
        if _URL_ONLY_RE.match(line):
            continue
        if any(pattern.match(line) for pattern in _BOILERPLATE_LINE_PATTERNS):
            continue
        cleaned_lines.append(line)

    while cleaned_lines and cleaned_lines[0] == "":
        cleaned_lines.pop(0)
    while cleaned_lines and cleaned_lines[-1] == "":
        cleaned_lines.pop()

    return "\n".join(cleaned_lines).strip()
