import pytest

from app.card_protocol import read_cards_response


def test_read_cards_response_accepts_v2_cards() -> None:
    cards = read_cards_response(
        {
            "cards": [
                {"type": "hook", "content": "Start with a question"},
                {"type": "insight", "content": "Explain the key idea"},
                {"type": "method", "content": "Show the first method"},
                {"type": "scenario", "content": "Apply it to a scene"},
                {"type": "summary", "content": "Close with one action"},
            ]
        },
        "Invalid cards response",
        minimum=5,
        maximum=7,
    )

    assert cards[0] == {"type": "hook", "content": "Start with a question"}
    assert cards[-1] == {"type": "summary", "content": "Close with one action"}


def test_read_cards_response_normalizes_legacy_strings() -> None:
    cards = read_cards_response(
        {"cards": ["hook", "idea one", "idea two", "method", "summary"]},
        "Invalid cards response",
        minimum=5,
        maximum=7,
    )

    assert [card["content"] for card in cards] == [
        "hook",
        "idea one",
        "idea two",
        "method",
        "summary",
    ]
    assert [card["type"] for card in cards] == [
        "hook",
        "insight",
        "insight",
        "method",
        "method",
    ]


@pytest.mark.parametrize(
    "raw_cards",
    [
        ["one", "two", "three", "four"],
        [
            {"type": "hook", "content": "one"},
            {"type": "unknown", "content": "two"},
            {"type": "method", "content": "three"},
            {"type": "scenario", "content": "four"},
            {"type": "summary", "content": "five"},
        ],
        [
            {"type": "hook", "content": "one"},
            "mixed legacy card",
            {"type": "method", "content": "three"},
            {"type": "scenario", "content": "four"},
            {"type": "summary", "content": "five"},
        ],
    ],
)
def test_read_cards_response_rejects_invalid_payloads(raw_cards: list[object]) -> None:
    with pytest.raises(RuntimeError, match="Invalid cards response"):
        read_cards_response(
            {"cards": raw_cards},
            "Invalid cards response",
            minimum=5,
            maximum=7,
        )
