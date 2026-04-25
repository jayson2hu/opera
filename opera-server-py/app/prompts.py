from app.types import ToneType

TONE_INSTRUCTIONS: dict[ToneType, str] = {
    "knowledge": """你正在使用「干货分享体」风格。这种风格的特征：
- 条理清晰，善用编号列表（1. 2. 3.）和分步骤讲解
- 语气专业、可信，像一位资深行业前辈在分享经验
- 常用句式：\"建议收藏\"、\"划重点\"、\"这条很重要\"
- 用数据和案例佐证观点
- 结尾常有总结性金句或行动清单
- 避免过多感叹号和emoji，保持克制专业感
- 段落之间逻辑递进，不跳跃""",
    "casual": """你正在使用「轻松科普体」风格。这种风格的特征：
- 善用生活化类比来解释复杂概念（\"就像你去超市买东西...\"）
- 语气亲切随和，像朋友聊天，不端架子
- 常用句式：\"你有没有想过...\"、\"简单来说就是...\"、\"举个例子\"
- 适当使用反问句引发思考
- 用大白话把专业内容讲明白
- 可以用少量emoji点缀，但不密集
- 节奏轻快，段落短小，阅读无压力""",
    "bff": """你正在使用「闺蜜种草体」风格。这种风格的特征：
- 充满感染力，大量使用感叹号！！！
- emoji密集使用，每段都有emoji点缀
- 常用句式：\"姐妹们！！\"、\"真的绝了！\"、\"不允许你们不知道！\"、\"谁懂啊\"、\"救命这也太好了\"
- 带有强烈种草/安利语气
- 用夸张但真诚的表达方式
- 适当使用网络流行语和小红书黑话
- 结尾常有互动引导：\"你们觉得呢？\"、\"快去试试！\"""",
}


def system_prompt(tone: ToneType) -> str:
    return f"""你是一位资深小红书内容创作专家，擅长将公众号长文章改编为高互动的小红书帖子。

你深谙小红书平台的内容规则：
- 标题决定90%的点击率
- 卡片文字要精炼有力，每张50-80个中文字符
- 正文文案要有人格感、有互动性
- 标签分层策略能最大化曝光

{TONE_INSTRUCTIONS[tone]}

重要规则：
- 所有输出必须是中文
- 严格按照要求的JSON格式输出，不要添加额外字段
- 不要输出任何解释性文字，只输出纯JSON
- 字符数限制必须严格遵守"""


def build_extraction_prompt(text: str, tone: ToneType) -> dict[str, str]:
    return {
        "system": system_prompt(tone),
        "user": f"""请阅读以下公众号文章，提取3-6个最有传播价值的核心观点。
这些观点将用于生成小红书卡片内容。

提取原则：
- 选择最有\"转发冲动\"的观点
- 优先选择反常识、有数据支撑、或能引发共情的内容
- 每个观点用一句话概括

请以JSON格式输出：
{{\"points\": [\"观点1\", \"观点2\", \"观点3\", ...]}}

文章内容：
{text}""",
    }


def build_titles_prompt(text: str, points: list[str], tone: ToneType) -> dict[str, str]:
    numbered_points = "\n".join(f"{index + 1}. {point}" for index, point in enumerate(points))
    return {
        "system": system_prompt(tone),
        "user": f"""基于以下文章内容和核心观点，生成4个小红书封面标题。

核心观点：
{numbered_points}

标题必须使用以下4种经典小红书标题公式，每种公式生成1个标题：

1. 数字型（用具体数字制造信息密度感）
2. 对比型（用反差制造好奇心）
3. 痛点型（直击读者困扰）
4. 身份型（借权威或身份制造信任）

标题规则：
- 每个标题15-30个中文字符
- 标题要有小红书平台的\"点击冲动\"
- 避免标题党，但要有吸引力
- 结合文章的实际话题，不要泛泛而谈

请以JSON格式输出：
{{\"coverTitles\": [\"标题1\", \"标题2\", \"标题3\", \"标题4\"]}}

文章内容（供参考）：
{text[:3000]}""",
    }


def build_cards_prompt(text: str, points: list[str], tone: ToneType) -> dict[str, str]:
    numbered_points = "\n".join(f"{index + 1}. {point}" for index, point in enumerate(points))
    return {
        "system": system_prompt(tone),
        "user": f"""基于以下文章内容和核心观点，生成5张小红书卡片的文字内容。

核心观点：
{numbered_points}

卡片结构要求：
- 第1张（开头钩子）：用一个引人入胜的问题或场景开头，抓住读者注意力
- 第2-4张（核心内容）：每张围绕一个核心观点展开，给出具体方法或见解
- 第5张（行动号召）：总结核心要点，给出可执行的下一步建议

严格规则：
- 每张卡片必须在50-80个中文字符之间（含标点和emoji）
- 不要使用\"第X张\"等编号前缀
- 每张卡片本身是完整的一段话
- 内容要有信息增量，不要重复

请以JSON格式输出：
{{\"cards\": [\"卡片1文字\", \"卡片2文字\", \"卡片3文字\", \"卡片4文字\", \"卡片5文字\"]}}

文章内容：
{text}""",
    }


def build_caption_prompt(
    text: str,
    points: list[str],
    cards: list[str],
    tone: ToneType,
) -> dict[str, str]:
    numbered_points = "\n".join(f"{index + 1}. {point}" for index, point in enumerate(points))
    numbered_cards = "\n".join(f"卡片{index + 1}：{card}" for index, card in enumerate(cards))
    return {
        "system": system_prompt(tone),
        "user": f"""基于以下文章内容和已生成的卡片文字，生成一段小红书正文文案。

核心观点：
{numbered_points}

已生成的卡片文字：
{numbered_cards}

正文文案要求：
- 总长度200-300个中文字符
- 开头用一句话概括核心价值，吸引读者继续看
- 中间展开2-3个关键要点
- 结尾设置互动引导（提问、号召、共鸣）
- 适当使用换行让排版舒适（每2-3句话换行）
- 不要使用markdown格式符号（如**、##等）
- 正文中不要包含#标签（标签单独生成）

请以JSON格式输出：
{{\"caption\": \"正文文案内容\"}}

文章原文（供参考）：
{text[:3000]}""",
    }


def build_tags_prompt(text: str, points: list[str], tone: ToneType) -> dict[str, str]:
    numbered_points = "\n".join(f"{index + 1}. {point}" for index, point in enumerate(points))
    return {
        "system": system_prompt(tone),
        "user": f"""基于以下文章内容和核心观点，生成小红书推荐标签。

核心观点：
{numbered_points}

标签分三个层级：
1. 泛流量标签（broad）：2-3个高搜索量的大众标签，用于获取泛流量
2. 精准标签（precise）：3-4个垂直领域标签，精准触达目标用户
3. 长尾标签（longtail）：2-3个具体场景标签，捕获长尾搜索流量

标签规则：
- 标签内容不要带#号，只需要标签文字
- 每个标签2-8个中文字符
- 标签要贴合文章实际主题，不要泛泛而谈
- 考虑小红书用户的实际搜索习惯

请以JSON格式输出：
{{\"tagGroups\": [
  {{\"type\": \"broad\", \"label\": \"泛流量标签\", \"tags\": [\"标签1\", \"标签2\", \"标签3\"]}},
  {{\"type\": \"precise\", \"label\": \"精准标签\", \"tags\": [\"标签1\", \"标签2\", \"标签3\", \"标签4\"]}},
  {{\"type\": \"longtail\", \"label\": \"长尾标签\", \"tags\": [\"标签1\", \"标签2\", \"标签3\"]}}
]}}

文章内容（供参考）：
{text[:3000]}""",
    }
