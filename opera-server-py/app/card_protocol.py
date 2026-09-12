from typing import Any, Literal, TypedDict, cast


CardType = Literal["hook", "insight", "method", "scenario", "summary"]


class CardPayload(TypedDict):
    type: CardType
    content: str


VALID_CARD_TYPES: frozenset[str] = frozenset(
    {"hook", "insight", "method", "scenario", "summary"}
)

# Mirrors the existing index-based labels so a new frontend can still display
# useful purposes when an older provider returns plain strings.
LEGACY_CARD_TYPES: tuple[CardType, ...] = (
    "hook",
    "insight",
    "insight",
    "method",
    "method",
    "scenario",
    "summary",
)


def _legacy_type(index: int) -> CardType:
    return LEGACY_CARD_TYPES[min(index, len(LEGACY_CARD_TYPES) - 1)]


def read_cards_response(
    parsed: Any,
    error_message: str,
    *,
    minimum: int,
    maximum: int,
) -> list[CardPayload]:
    """Normalize v2 object cards and legacy string cards into one contract."""
    if not isinstance(parsed, dict):
        raise RuntimeError(error_message)

    raw_cards = parsed.get("cards")
    if not isinstance(raw_cards, list) or not minimum <= len(raw_cards) <= maximum:
        raise RuntimeError(error_message)

    if all(isinstance(card, str) for card in raw_cards):
        normalized: list[CardPayload] = []
        for index, raw_card in enumerate(cast(list[str], raw_cards)):
            content = raw_card.strip()
            if not content:
                raise RuntimeError(error_message)
            normalized.append({"type": _legacy_type(index), "content": content})
        return normalized

    if not all(isinstance(card, dict) for card in raw_cards):
        raise RuntimeError(error_message)

    normalized = []
    for raw_card in cast(list[dict[str, Any]], raw_cards):
        card_type = raw_card.get("type")
        content = raw_card.get("content")
        if (
            not isinstance(card_type, str)
            or card_type not in VALID_CARD_TYPES
            or not isinstance(content, str)
            or not content.strip()
        ):
            raise RuntimeError(error_message)
        normalized.append(
            {
                "type": cast(CardType, card_type),
                "content": content.strip(),
            }
        )
    return normalized
