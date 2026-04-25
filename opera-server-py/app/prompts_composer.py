from __future__ import annotations

import json

from app.prompts import TONE_INSTRUCTIONS
from app.types import ContentType, TargetLength, ToneType

CONTENT_TYPE_INSTRUCTIONS: dict[ContentType, str] = {
    "recommend": "你正在创作「种草推荐」内容。重点是突出真实体验、使用感受、适合人群和推荐理由，语言要有代入感。",
    "knowledge": "你正在创作「干货分享」内容。重点是方法论清晰、步骤明确、观点有信息增量，适合做收藏型内容。",
    "story": "你正在创作「个人经历」内容。重点是真实细节、前后变化、情绪波动和经验复盘，要让人感觉这就是作者亲身经历。",
    "tutorial": "你正在创作「知识科普」内容。重点是把复杂概念说人话，避免术语堆砌，多用生活化表达帮助理解。",
}

TARGET_LENGTH_INSTRUCTIONS: dict[TargetLength, str] = {
    "short": "正文目标约 180-240 个中文字符，信息密度高，适合快速阅读。",
    "medium": "正文目标约 320-450 个中文字符，结构完整，有 3-4 个重点。",
    "long": "正文目标 600 个中文字符以上，适合展开经历、方法或案例细节。",
}


def composer_system_prompt(
    content_type: ContentType,
    tone: ToneType,
    target_length: TargetLength,
) -> str:
    return f"""你是一位资深小红书原创内容策划与写作专家，擅长把一个朴素主题想法，写成可以直接发布的小红书帖子。

你的任务不是改写已有文章，而是围绕用户给出的主题进行原创策划、结构规划和文案创作。

平台规则：
- 标题要在 25 字以内，能激发点击但不过度标题党
- 正文要有明显结构感、可读性和真实感
- 正文不要使用 markdown 符号（如 #、*、##、**）
- 标签要贴近真实搜索习惯，不要空泛
- 所有输出必须使用中文

内容类型要求：
{CONTENT_TYPE_INSTRUCTIONS[content_type]}

目标字数要求：
{TARGET_LENGTH_INSTRUCTIONS[target_length]}

调性要求：
{TONE_INSTRUCTIONS[tone]}
"""


def _stringify_structure(structure: dict[str, object]) -> str:
    return json.dumps(structure, ensure_ascii=False, indent=2)


def build_composer_extraction_prompt(
    topic: str,
    content_type: ContentType,
    tone: ToneType,
    target_length: TargetLength,
) -> dict[str, str]:
    return {
        "system": composer_system_prompt(content_type, tone, target_length),
        "user": f"""请理解以下原创创作主题，并先完成创作策划。

主题描述：
{topic}

请输出一个 JSON 对象，字段必须完整：
{{
  "angle": "这篇内容的核心表达角度",
  "audience": "最适合阅读的人群",
  "hook": "开头抓人的一句话或切入点",
  "outline": ["段落1重点", "段落2重点", "段落3重点"],
  "mustMention": ["必须提到的事实/细节/结果"],
  "cta": "结尾互动或行动号召"
}}

规则：
- `outline` 至少 3 条，最多 5 条
- `mustMention` 至少 2 条，最多 4 条
- 不要输出解释，只输出 JSON""",
    }


def build_composer_title_prompt(
    topic: str,
    structure: dict[str, object],
    tone: ToneType,
) -> dict[str, str]:
    return {
        "system": f"""你是一位资深小红书标题编辑。

{TONE_INSTRUCTIONS[tone]}

请只输出 JSON，不要解释。""",
        "user": f"""基于以下主题和创作结构，生成 1 个最适合直接发布的小红书标题。

主题：
{topic}

创作结构：
{_stringify_structure(structure)}

标题要求：
- 15-25 个中文字符
- 具体、自然、有点击冲动
- 不要带书名号、引号或 emoji
- 不要输出多个备选

请输出 JSON：
{{"title": "标题内容"}}""",
    }


def build_composer_body_prompt(
    topic: str,
    structure: dict[str, object],
    tone: ToneType,
    target_length: TargetLength,
    content_type: ContentType,
) -> dict[str, str]:
    return {
        "system": composer_system_prompt(content_type, tone, target_length),
        "user": f"""基于以下主题和创作结构，写出一篇可以直接发布的小红书正文。

主题：
{topic}

创作结构：
{_stringify_structure(structure)}

正文要求：
- 开头先给出抓人的观点或经历切口
- 中间围绕 `outline` 展开，保证层次分明、有信息增量
- 自然融入 `mustMention` 中的重要事实或结果
- 结尾给出互动提问、行动建议或共鸣收束
- 使用自然换行优化阅读节奏
- 不要出现标题、标签、markdown 语法、解释性前缀
- 只输出正文内容本身，不要输出 JSON
""",
    }


def build_composer_tags_prompt(topic: str, title: str, body: str) -> dict[str, str]:
    return {
        "system": """你是一位熟悉小红书搜索习惯的内容运营，请根据主题、标题和正文生成标签与配图关键词。

所有输出必须是中文，只输出 JSON。""",
        "user": f"""请基于以下内容生成标签和配图关键词。

主题：
{topic}

标题：
{title}

正文：
{body[:4000]}

输出要求：
- `tags` 生成 6-10 个，不带 # 号，每个 2-10 个中文字符
- `imageKeywords` 生成 3-5 个，用于搜图或配图提示
- 标签要兼顾泛流量与精准搜索，不要空泛
- 配图关键词要具体可执行

请输出 JSON：
{{
  "tags": ["标签1", "标签2", "标签3"],
  "imageKeywords": ["关键词1", "关键词2", "关键词3"]
}}""",
    }
