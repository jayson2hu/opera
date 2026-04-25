from __future__ import annotations

import json

from app.prompts import TONE_INSTRUCTIONS
from app.types import TargetLength, ToneType, WeChatArticleType

ARTICLE_TYPE_INSTRUCTIONS: dict[WeChatArticleType, str] = {
    "insight": "你正在创作「观点评论」文章。重点是明确判断、趋势洞察、利弊分析与结论力度。",
    "guide": "你正在创作「方法指南」文章。重点是结构清晰、步骤可执行、信息密度高，适合收藏转发。",
    "story": "你正在创作「经历复盘」文章。重点是真实细节、问题转折、经验沉淀和个人表达。",
    "briefing": "你正在创作「精选简报」文章。重点是信息提炼、框架归纳、重点摘要与后续观察。",
}

TARGET_LENGTH_INSTRUCTIONS: dict[TargetLength, str] = {
    "short": "正文目标约 500-800 个中文字符，适合短篇观点文或简明指南。",
    "medium": "正文目标约 900-1400 个中文字符，适合结构完整的公众号文章。",
    "long": "正文目标约 1600 个中文字符以上，适合深度复盘、案例拆解或专题内容。",
}


def wechat_system_prompt(
    article_type: WeChatArticleType,
    tone: ToneType,
    target_length: TargetLength,
) -> str:
    return f"""你是一位资深微信公众号内容主编，擅长把一个主题想法策划成适合公众号发布的完整原创文章。

你的任务不是写短视频口播稿，也不是写小红书帖子，而是输出更适合公众号阅读场景的长文内容。

平台规则：
- 标题要自然、可信、具备点击意愿，但不要过度标题党
- 摘要适合作为导语、封面描述或草稿箱说明
- 正文必须层次清晰、分段自然、适合连续阅读
- 不要输出 markdown 标题符号、列表符号或代码块
- 所有输出必须使用中文

文章类型要求：
{ARTICLE_TYPE_INSTRUCTIONS[article_type]}

目标篇幅要求：
{TARGET_LENGTH_INSTRUCTIONS[target_length]}

调性要求：
{TONE_INSTRUCTIONS[tone]}
"""


def _stringify_structure(structure: dict[str, object]) -> str:
    return json.dumps(structure, ensure_ascii=False, indent=2)


def build_wechat_extraction_prompt(
    topic: str,
    article_type: WeChatArticleType,
    tone: ToneType,
    target_length: TargetLength,
) -> dict[str, str]:
    return {
        "system": wechat_system_prompt(article_type, tone, target_length),
        "user": f"""请理解以下公众号原创选题，并先完成文章策划。

主题描述：
{topic}

请只输出 JSON，对象字段必须完整：
{{
  "angle": "文章核心切入角度",
  "audience": "最适合阅读的人群",
  "promise": "这篇文章能为读者解决什么问题或带来什么价值",
  "outline": ["第1部分重点", "第2部分重点", "第3部分重点"],
  "keyPoints": ["必须写到的事实或结论", "必须写到的案例或建议"],
  "cta": "结尾互动、提醒或行动建议"
}}

规则：
- `outline` 至少 3 条，最多 6 条
- `keyPoints` 至少 2 条，最多 5 条
- 不要输出解释，只输出 JSON""",
    }


def build_wechat_title_prompt(topic: str, structure: dict[str, object]) -> dict[str, str]:
    return {
        "system": """你是一位资深公众号标题编辑。请只输出 JSON，不要解释。""",
        "user": f"""基于以下主题和文章结构，生成 1 个适合公众号发布的标题。

主题：
{topic}

文章结构：
{_stringify_structure(structure)}

标题要求：
- 14-32 个中文字符
- 具体、可信、有明确承诺感
- 不使用夸张口语、emoji、书名号、引号
- 不输出多个备选

请输出 JSON：
{{"title": "标题内容"}}""",
    }


def build_wechat_digest_prompt(topic: str, structure: dict[str, object], title: str | None = None) -> dict[str, str]:
    title_context = f"当前标题：\n{title}\n\n" if title else ""
    return {
        "system": """你是一位熟悉公众号封面导语和文章摘要写法的编辑。请只输出 JSON，不要解释。""",
        "user": f"""请基于以下主题与文章结构，生成一段适合作为公众号摘要或导语的文案。

主题：
{topic}

{title_context}文章结构：
{_stringify_structure(structure)}

摘要要求：
- 60-120 个中文字符
- 说明读者能获得什么、为什么值得读完
- 语气自然，不要像广告，不要写成标题

请输出 JSON：
{{"digest": "摘要内容"}}""",
    }


def build_wechat_body_prompt(
    topic: str,
    structure: dict[str, object],
    article_type: WeChatArticleType,
    tone: ToneType,
    target_length: TargetLength,
    title: str | None = None,
    digest: str | None = None,
) -> dict[str, str]:
    header_context = []
    if title:
        header_context.append(f"标题：\n{title}")
    if digest:
        header_context.append(f"摘要：\n{digest}")
    header = "\n\n".join(header_context)
    header_block = f"{header}\n\n" if header else ""

    return {
        "system": wechat_system_prompt(article_type, tone, target_length),
        "user": f"""请基于以下主题和文章结构，写出一篇适合公众号发布的原创正文。

主题：
{topic}

{header_block}文章结构：
{_stringify_structure(structure)}

正文要求：
- 开头快速建立问题、冲突或阅读期待
- 中间严格围绕 `outline` 展开，保证层次分明
- 自然融入 `keyPoints` 中的重要信息
- 结尾落到 `cta`，形成总结、提醒或互动
- 使用自然分段优化阅读体验
- 只输出正文内容本身，不要输出 JSON、标题、摘要或附言
- 不要写“以上就是”“总之来说”这类机械收束句
""",
    }
