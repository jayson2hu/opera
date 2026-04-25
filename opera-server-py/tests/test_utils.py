import pytest

from app.utils import extract_json, preprocess_article_text


def test_extract_json_parses_fenced_json() -> None:
    raw = '```json\n{"title": "标题内容"}\n```'
    assert extract_json(raw) == {"title": "标题内容"}


def test_extract_json_parses_prefixed_json_object() -> None:
    raw = '下面是结果：\n{"digest": "这是一段摘要"}\n请继续。'
    assert extract_json(raw) == {"digest": "这是一段摘要"}


def test_extract_json_raises_when_missing_json() -> None:
    with pytest.raises(ValueError):
        extract_json("plain text without json")


def test_preprocess_article_text_strips_html_and_boilerplate() -> None:
    raw = """
    <section>
      <p>点击上方蓝字关注我们</p>
      <p>作者：运营团队</p>
      <p>这是正文第一段，保留真正的观点与案例。</p>
      <p>第二段会继续解释方法，并补充执行细节。</p>
      <p>阅读原文</p>
      <p>https://mp.weixin.qq.com/s/example</p>
    </section>
    """

    assert preprocess_article_text(raw) == (
        "这是正文第一段，保留真正的观点与案例。\n\n第二段会继续解释方法，并补充执行细节。"
    )


def test_preprocess_article_text_preserves_plain_text() -> None:
    raw = "第一段内容。\n\n第二段内容。"
    assert preprocess_article_text(raw) == raw
