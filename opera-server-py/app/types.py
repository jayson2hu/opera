from typing import Literal

from pydantic import BaseModel

ToneType = Literal["knowledge", "casual", "bff"]
ProviderId = Literal["anthropic", "deepseek", "custom"]
TagGroupType = Literal["broad", "precise", "longtail"]
GenerationStep = Literal["extracting", "titles", "cards", "caption", "tags", "done"]
ContentType = Literal["recommend", "knowledge", "story", "tutorial"]
TargetLength = Literal["short", "medium", "long"]
ComposerStep = Literal["extracting", "title", "body", "tags", "done"]
ComposerRegenerateTarget = Literal["title", "body", "tags"]
WeChatArticleType = Literal["insight", "guide", "story", "briefing"]
WeChatStep = Literal["extracting", "title", "digest", "body", "done"]
WeChatRegenerateTarget = Literal["title", "digest", "body"]


class TagGroup(BaseModel):
    type: TagGroupType
    label: str
    tags: list[str]


class GenerationResult(BaseModel):
    coverTitles: list[str]
    cards: list[str]
    caption: str
    tagGroups: list[TagGroup]


class ComposerResult(BaseModel):
    title: str
    body: str
    tags: list[str]
    imageKeywords: list[str]


class WeChatComposeResult(BaseModel):
    title: str
    digest: str
    body: str


class GenerateRequestModel(BaseModel):
    text: str
    tone: ToneType
    targetLength: TargetLength = "medium"
    provider: ProviderId | None = None
    model: str | None = None


class ComposeRequestModel(BaseModel):
    topic: str
    contentType: ContentType
    tone: ToneType
    targetLength: TargetLength
    provider: ProviderId | None = None
    model: str | None = None
    regenerate: ComposerRegenerateTarget | None = None


class WeChatComposeRequestModel(BaseModel):
    topic: str
    articleType: WeChatArticleType
    tone: ToneType
    targetLength: TargetLength
    provider: ProviderId | None = None
    model: str | None = None
    regenerate: WeChatRegenerateTarget | None = None


class ProviderInfo(BaseModel):
    id: ProviderId
    name: str
    models: list[str]


class ProvidersResponse(BaseModel):
    default: ProviderId
    available: list[ProviderInfo]
