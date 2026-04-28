from app.types import TargetLength, ToneType

TONE_INSTRUCTIONS: dict[ToneType, str] = {
    "knowledge": """风格：知识分享型。
- 结构清晰，适合方法论、经验总结、观点拆解。
- 语气专业可信，但不要像论文。
- 多用编号、清单、步骤和具体例子。
- 少用夸张感叹和密集 emoji。""",
    "casual": """风格：轻松解释型。
- 像朋友解释复杂概念，语言自然。
- 多用生活化比喻和短句。
- 可以适度使用反问，让读者更容易代入。
- 节奏轻快，避免术语堆叠。""",
    "bff": """风格：朋友推荐型。
- 更有情绪和代入感，适合种草、推荐、经验分享。
- 可以使用少量 emoji 和更强的互动语气。
- 语言真诚，不要空喊口号。
- 结尾要有明确互动引导。""",
}

CAPTION_LENGTH_INSTRUCTIONS: dict[TargetLength, str] = {
    "short": "正文目标长度：300-500 个中文字符。适合快速发布，保留核心观点和行动建议。",
    "medium": "正文目标长度：600-900 个中文字符。适合标准小红书图文帖，信息完整，有展开、有例子、有互动。",
    "long": "正文目标长度：1000-1500 个中文字符。适合深度改写，保留更多原文逻辑、场景、方法和行动清单。",
}


def system_prompt(tone: ToneType) -> str:
    return f"""你是一位资深小红书内容改写专家，擅长把公众号文章和长文素材改写成可发布的小红书图文内容。

你理解小红书内容的关键要求：
- 标题要给用户明确点击理由。
- 图文卡片要像可直接排版的 slide 文案。
- 发布正文要有完整信息量，不只是摘要。
- 标签要分层，便于曝光和搜索。

{TONE_INSTRUCTIONS[tone]}

重要规则：
- 所有输出必须是中文。
- 严格按照要求的 JSON 格式输出，不要添加额外字段。
- 不要输出解释性文字，只输出纯 JSON。
- 不要编造原文没有支持的事实、数据、身份或案例。"""


def build_extraction_prompt(text: str, tone: ToneType) -> dict[str, str]:
    return {
        "system": system_prompt(tone),
        "user": f"""请阅读下面的公众号文章或长文素材，提取 6-8 个最适合改写成小红书内容的核心观点。

提取原则：
- 优先选择能引发共鸣、转发、收藏或评论的观点。
- 每个观点要具体，不要只写抽象主题。
- 尽量覆盖原文的主要逻辑链路：问题、原因、方法、例子、结论。
- 每个观点用一句完整中文概括。

请以 JSON 格式输出：
{{"points": ["观点1", "观点2", "观点3", "观点4", "观点5", "观点6"]}}

原文：
{text}""",
    }


def build_titles_prompt(text: str, points: list[str], tone: ToneType) -> dict[str, str]:
    numbered_points = "\n".join(f"{index + 1}. {point}" for index, point in enumerate(points))
    return {
        "system": system_prompt(tone),
        "user": f"""基于下面的核心观点，生成 6 个小红书封面标题。

核心观点：
{numbered_points}

标题公式要求：
1. 数字型：用数字制造信息密度。
2. 对比型：用前后反差制造好奇。
3. 痛点型：直接击中读者困扰。
4. 身份型：让目标读者觉得“这是写给我的”。
5. 收益型：突出读完后能获得什么。
6. 好奇型：制造悬念，但不能标题党。

标题规则：
- 每个标题 15-30 个中文字符。
- 标题要具体、有点击理由。
- 不要夸大原文没有的结论。
- 不要出现编号前缀。

请以 JSON 格式输出：
{{"coverTitles": ["标题1", "标题2", "标题3", "标题4", "标题5", "标题6"]}}

原文参考：
{text[:3000]}""",
    }


def build_cards_prompt(text: str, points: list[str], tone: ToneType) -> dict[str, str]:
    numbered_points = "\n".join(f"{index + 1}. {point}" for index, point in enumerate(points))
    return {
        "system": system_prompt(tone),
        "user": f"""基于下面的原文和核心观点，生成 7 张小红书图文卡片的文字内容。

核心观点：
{numbered_points}

卡片结构：
1. 开头钩子：指出读者痛点或反常识发现。
2. 核心洞察 1：解释最重要的观点。
3. 核心洞察 2：补充原因或背景。
4. 核心洞察 3：给出方法或判断标准。
5. 方法清单：整理可执行步骤。
6. 应用场景：说明读者可以怎么用。
7. 行动总结：收束观点并给出下一步。

严格规则：
- 必须输出 7 张卡片。
- 每张卡片 70-110 个中文字符。
- 不要使用“第1张”“卡片1”等编号前缀。
- 每张卡片本身是一段可直接放进图片里的完整文案。
- 内容要有信息增量，不要重复同一句话。

请以 JSON 格式输出：
{{"cards": ["卡片1文案", "卡片2文案", "卡片3文案", "卡片4文案", "卡片5文案", "卡片6文案", "卡片7文案"]}}

原文：
{text}""",
    }


def build_caption_prompt(
    text: str,
    points: list[str],
    cards: list[str],
    tone: ToneType,
    target_length: TargetLength = "medium",
) -> dict[str, str]:
    numbered_points = "\n".join(f"{index + 1}. {point}" for index, point in enumerate(points))
    numbered_cards = "\n".join(f"卡片{index + 1}：{card}" for index, card in enumerate(cards))
    length_instruction = CAPTION_LENGTH_INSTRUCTIONS[target_length]
    return {
        "system": system_prompt(tone),
        "user": f"""基于原文、核心观点和图文卡片，生成一篇小红书发布正文。

核心观点：
{numbered_points}

已生成的卡片文案：
{numbered_cards}

正文要求：
- {length_instruction}
- 开头 1-2 段要快速说明读者为什么要继续看。
- 中间展开 3-5 个关键点，不能只复述卡片，要补充解释、场景或行动建议。
- 结尾给出 2-3 个可执行步骤或互动提问。
- 每 2-3 句话换行一次，方便手机阅读。
- 不要使用 Markdown 标题、加粗符号或列表符号。
- 正文中不要包含话题标签，标签会单独生成。

请以 JSON 格式输出：
{{"caption": "正文文案内容"}}

原文参考：
{text[:5000]}""",
    }


def build_tags_prompt(text: str, points: list[str], tone: ToneType) -> dict[str, str]:
    numbered_points = "\n".join(f"{index + 1}. {point}" for index, point in enumerate(points))
    return {
        "system": system_prompt(tone),
        "user": f"""基于下面的文章内容和核心观点，生成小红书推荐标签。

核心观点：
{numbered_points}

标签分三层：
1. broad：2-3 个泛流量标签，用于获取基础曝光。
2. precise：3-4 个精准标签，用于触达目标用户。
3. longtail：2-3 个长尾标签，用于具体搜索场景。

规则：
- 标签内容不要带 # 号。
- 每个标签 2-8 个中文字符。
- 标签要贴合文章主题，不要泛泛而谈。

请以 JSON 格式输出：
{{"tagGroups": [
  {{"type": "broad", "label": "泛流量标签", "tags": ["标签1", "标签2", "标签3"]}},
  {{"type": "precise", "label": "精准标签", "tags": ["标签1", "标签2", "标签3"]}},
  {{"type": "longtail", "label": "长尾标签", "tags": ["标签1", "标签2"]}}
]}}

原文参考：
{text[:3000]}""",
    }
