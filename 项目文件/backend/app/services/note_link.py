"""笔记双链服务：出边重建、反向链接、图谱。

note_link 是双链边的唯一数据源，不扫描 JSON。反向链接与图谱均为
高频读操作，走索引查询而非遍历文档结构。

边来源仅含 wikilink 节点（设计规格 8.1）；note-embed 为只读渲染卡片，
不计入知识图谱。
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.note_link import NoteLink
from app.models.note_folder import NoteFolder, NoteFolderMembership


def extract_link_targets(body: dict[str, Any] | None) -> list[str]:
    """从 Tiptap JSON 提取 wikilink 节点的 target_id（去重、保序）。

    仅识别 type == "wikilink" 的节点，其余节点结构一律忽略。
    """
    out: list[str] = []

    def walk(node: dict[str, Any]) -> None:
        if node.get("type") == "wikilink":
            target = (node.get("attrs") or {}).get("target_id")
            if target and target not in out:
                out.append(target)
        for child in node.get("content") or []:
            if isinstance(child, dict):
                walk(child)

    if isinstance(body, dict):
        walk(body)
    return out


def _is_uuid(value: str) -> bool:
    """判断字符串是否为合法 UUID。"""
    try:
        uuid.UUID(value)
    except (ValueError, TypeError):
        return False
    return True


async def rebuild_outgoing_links(
    db: AsyncSession, note_id: uuid.UUID, body: dict[str, Any] | None
) -> None:
    """全量重建某笔记的出边（先删后插）。

    目标笔记不存在或 id 非法时静默跳过，不阻断保存。
    调用方负责事务；本函数只 flush 不 commit。
    """
    await db.execute(delete(NoteLink).where(NoteLink.source_id == note_id))

    raw = extract_link_targets(body)
    if not raw:
        await db.flush()
        return

    candidates = [uuid.UUID(t) for t in raw if _is_uuid(t)]
    valid = (
        (await db.execute(select(Note.id).where(Note.id.in_(candidates))))
        .scalars()
        .all()
    )

    for target_id in valid:
        db.add(NoteLink(source_id=note_id, target_id=target_id))
    await db.flush()


async def get_backlinks(
    db: AsyncSession, note_id: uuid.UUID, user_id: uuid.UUID
) -> list[dict[str, Any]]:
    """返回引用 note_id 的笔记列表（已做可见性过滤，按更新时间倒序）。

    摘要优先取 plain_text，回退到 content；截断至 120 字。
    """
    # 延迟导入：app.services.note 会导入本模块，模块级导入会造成循环
    from app.services.note import _visibility_get_check

    src_ids = (
        (
            await db.execute(
                select(NoteLink.source_id).where(NoteLink.target_id == note_id)
            )
        )
        .scalars()
        .all()
    )
    if not src_ids:
        return []

    notes = (
        (await db.execute(select(Note).where(Note.id.in_(list(src_ids)))))
        .scalars()
        .all()
    )

    out: list[dict[str, Any]] = []
    for note in notes:
        if not _visibility_get_check(note, user_id):
            continue
        excerpt = (note.plain_text or note.content or "")[:120] or None
        out.append(
            {
                "note_id": str(note.id),
                "title": note.title,
                "excerpt": excerpt,
                "updated_at": note.updated_at.isoformat(),
            }
        )

    out.sort(key=lambda item: item["updated_at"], reverse=True)
    return out


async def get_graph(
    db: AsyncSession,
    user_id: uuid.UUID,
    root_id: uuid.UUID | None = None,
    depth: int = 1,
) -> dict[str, Any]:
    """构建知识图谱：节点为可见笔记，边来自 note_link。

    root_id 为空返回全局图谱；否则以 root_id 为根做双向 N 跳遍历
    （depth 限制在 1~2，避免大范围查询拖慢接口）。
    """
    from app.services.visibility import check_visibility as build_visibility_filter

    visible = select(Note).where(build_visibility_filter(Note, user_id))

    if root_id is None:
        notes = list((await db.execute(visible)).scalars().all())
    else:
        visited: set[uuid.UUID] = {root_id}
        frontier: list[uuid.UUID] = [root_id]
        for _ in range(max(1, min(depth, 2))):
            rows = await db.execute(
                select(NoteLink).where(
                    NoteLink.source_id.in_(frontier) | NoteLink.target_id.in_(frontier)
                )
            )
            next_frontier: list[uuid.UUID] = []
            for link in rows.scalars().all():
                for candidate in (link.source_id, link.target_id):
                    if candidate not in visited:
                        visited.add(candidate)
                        next_frontier.append(candidate)
            frontier = next_frontier
        notes = list(
            (await db.execute(visible.where(Note.id.in_(list(visited)))))
            .scalars()
            .all()
        )

    ids = {note.id for note in notes}
    if not ids:
        return {"nodes": [], "links": []}

    links = (
        (
            await db.execute(
                select(NoteLink).where(
                    NoteLink.source_id.in_(list(ids)),
                    NoteLink.target_id.in_(list(ids)),
                )
            )
        )
        .scalars()
        .all()
    )

    # 节点附带文件夹名与标签：供前端按文件夹 / 标签着色与生成图例。
    # 原 category 列已随父子嵌套一并废弃删除。
    membership_rows = (
        await db.execute(
            select(NoteFolderMembership.note_id, NoteFolder.name)
            .join(
                NoteFolder,
                NoteFolder.id == NoteFolderMembership.folder_id,
            )
            .where(NoteFolderMembership.note_id.in_(list(ids)))
        )
    ).all()
    folders_by_note: dict[str, list[str]] = {}
    for note_id, name in membership_rows:
        folders_by_note.setdefault(str(note_id), []).append(name)
    for names in folders_by_note.values():
        names.sort()

    return {
        "nodes": [
            {
                "id": str(note.id),
                "title": note.title,
                "folders": folders_by_note.get(str(note.id), []),
                "tags": list(note.tags or []),
                "is_pinned": note.is_pinned,
            }
            for note in notes
        ],
        "links": [
            {"source": str(link.source_id), "target": str(link.target_id)}
            for link in links
        ],
    }
