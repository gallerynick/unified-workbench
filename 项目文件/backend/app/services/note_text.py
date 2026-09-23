"""Tiptap body <-> 纯文本 互转。"""

from __future__ import annotations

from typing import Any

# 需要在其后插入空行的块级节点类型
_BLOCK_TYPES = frozenset(
    {
        "paragraph",
        "heading",
        "blockquote",
        "bulletList",
        "orderedList",
        "taskList",
        "taskItem",
        "codeBlock",
    }
)


def extract_plain_text(body: dict[str, Any] | None) -> str | None:
    """从 Tiptap JSON 提取纯文本，段落间以双换行分隔。

    body 为空或结构不符时返回 None；提取结果为空白时也返回 None，
    便于数据库列直接存 NULL。
    """
    if not body or not isinstance(body, dict):
        return None

    buf: list[str] = []

    def walk(node: dict[str, Any]) -> None:
        ntype = node.get("type")
        if ntype == "text":
            buf.append(node.get("text") or "")
            return
        for child in node.get("content") or []:
            if isinstance(child, dict):
                walk(child)
        if ntype in _BLOCK_TYPES:
            buf.append("\n\n")

    walk(body)
    text = "".join(buf).strip()
    return text or None
