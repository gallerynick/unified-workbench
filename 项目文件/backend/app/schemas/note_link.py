"""笔记双链、图谱与标签聚合 Schema。"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class BacklinkItem(BaseModel):
    """反向链接条目：正文中 wikilink 指向当前笔记的其他笔记。"""

    note_id: str
    title: str
    excerpt: str | None = None
    updated_at: str


class GraphData(BaseModel):
    """知识图谱数据：节点为可见笔记，边来自 note_link 表。"""

    nodes: list[dict[str, Any]]
    links: list[dict[str, Any]]


class TagCount(BaseModel):
    """标签及其在可见笔记中的出现次数。"""

    tag: str
    count: int
