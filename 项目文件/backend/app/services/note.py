"""笔记服务"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, delete, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.note import Note
from app.models.note_folder import NoteFolder, NoteFolderMembership
from app.models.user import User, UserRole
from app.schemas.note import NoteCreate, NoteUpdate
from app.services.note_link import rebuild_outgoing_links
from app.services.note_text import extract_plain_text
from app.services.visibility import check_visibility as build_visibility_filter

# ── 辅助函数 ──────────────────────────────────────────────────────────


def _derive_plain_text(body: dict[str, Any] | None, content: str | None) -> str | None:
    """派生纯文本：优先从新版 body 提取，无 body 时回退旧版 content。"""
    return extract_plain_text(body) or (content or None)


def _tags_contains_expr(db: AsyncSession, value: str) -> ColumnElement[bool]:
    """构建「tags 数组包含 value」的过滤表达式。

    PostgreSQL（生产库）用 JSONB 的 @> 包含语义，可被 GIN 索引加速；
    SQLite（仅测试库）没有 @> 运算符，改用 JSON1 的 json_each 做元素
    存在性判断。SQLite 下必须直接传列本身——写成 CAST(tags AS JSON) 会
    使 json_each 返回空结果（实测行为），故不做类型转换。
    """
    if db.bind is not None and db.bind.dialect.name == "sqlite":
        elements = func.json_each(Note.tags).table_valued("value")
        return exists(select(1).select_from(elements).where(elements.c.value == value))
    return Note.tags.contains([value])


def _folder_contains_expr(search: str) -> ColumnElement[bool]:
    """「该笔记所属任一文件夹的名称或简介命中 search」的关联条件。

    用 exists 子查询而非 join：关联表会产生重复行，直接 join 会放大
    count 与分页结果，exists 只表达命中与否。
    """
    like = f"%{search}%"
    return exists(
        select(1)
        .select_from(NoteFolderMembership)
        .join(NoteFolder, NoteFolder.id == NoteFolderMembership.folder_id)
        .where(
            NoteFolderMembership.note_id == Note.id,
            NoteFolder.name.ilike(like) | NoteFolder.description.ilike(like),
        )
    )


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: Note, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


def _admin_can_manage_own_designated(item: Note, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.restricted_users and str(user_id) in item.restricted_users:
        return True
    return False


async def _require_manage_permission(
    db: AsyncSession, item: Note, user_id: uuid.UUID, action: str
) -> None:
    """检查管理权限（owner 或 admin-own+designated）。"""
    if item.owner_id == user_id:
        return
    _role_result = await db.execute(select(User.role).where(User.id == user_id))
    _user_role = _role_result.scalar_one_or_none()
    _is_admin = _user_role == UserRole.ADMIN
    if not (_is_admin and _admin_can_manage_own_designated(item, user_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=f"无权{action}"
        )


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_notes(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    tag: str | None = None,
    folder_id: uuid.UUID | None = None,
) -> tuple[list[Note], int]:
    user_id = owner_id
    visibility_cond = build_visibility_filter(Note, user_id)
    query = select(Note).where(visibility_cond)

    if search:
        like = f"%{search}%"
        # 标题/正文按文本模糊匹配；tags 为 JSON 数组按元素包含判断；
        # 文件夹按名称与简介关联匹配
        query = query.where(
            Note.title.ilike(like)
            | Note.plain_text.ilike(like)
            | _tags_contains_expr(db, search)
            | _folder_contains_expr(search)
        )
    if tag:
        # 精确标签筛选：按数组元素相等判断，不误伤同名字符串前缀
        query = query.where(_tags_contains_expr(db, tag))
    if folder_id is not None:
        # 按文件夹过滤：取该文件夹下所有笔记 id
        query = query.where(
            Note.id.in_(
                select(NoteFolderMembership.note_id).where(
                    NoteFolderMembership.folder_id == folder_id
                )
            )
        )
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = (
        query.order_by(Note.is_pinned.desc(), Note.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def _reload_note(db: AsyncSession, note_id: uuid.UUID) -> Note | None:
    """重新查询笔记。

    create/update 后 ORM 实例的关系尚未加载，直接读 note.folders 在异步会话中
    会触发惰性加载并报 MissingGreenlet；重新 select 会按 lazy="selectin"
    一并把 folders 加载出来。
    """
    result = await db.execute(
        select(Note)
        .where(Note.id == note_id)
        # populate_existing：覆盖身份映射中的旧实例，确保 folders 关系按
        # 当前数据库状态重新加载，而不是返回上一次查询缓存的空列表
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_note(
    db: AsyncSession, note_id: uuid.UUID, owner_id: uuid.UUID
) -> Note | None:
    user_id = owner_id
    result = await db.execute(select(Note).where(Note.id == note_id))
    item = result.scalar_one_or_none()
    if not item:
        return None
    if not _visibility_get_check(item, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")
    return item


# ── 创建（不变）─────────────────────────────────────────────────────


async def create_note(
    db: AsyncSession, owner_id: uuid.UUID, request: NoteCreate
) -> Note:
    note = Note(
        title=request.title,
        content=request.content,
        body=request.body,
        plain_text=_derive_plain_text(request.body, request.content),
        tags=request.tags,
        restricted_tags=request.restricted_tags,
        is_pinned=request.is_pinned,
        owner_id=owner_id,
    )
    db.add(note)
    await db.flush()
    # 出边随 body 全量重建（先删后插），保证反向链接与图谱同步
    await rebuild_outgoing_links(db, note.id, note.body)
    return await _reload_note(db, note.id)


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_note(
    db: AsyncSession,
    note_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: NoteUpdate,
) -> Note | None:
    user_id = owner_id
    note = await get_note(db, note_id, user_id)
    if not note:
        return None

    await _require_manage_permission(db, note, user_id, "修改")

    if request.title is not None:
        note.title = request.title
    if request.content is not None:
        note.content = request.content
    if request.body is not None:
        note.body = request.body
    if request.tags is not None:
        note.tags = request.tags
    if request.restricted_tags is not None:
        note.restricted_tags = request.restricted_tags
    if request.is_pinned is not None:
        note.is_pinned = request.is_pinned

    # 纯文本与最新正文保持一致：优先新版 body，旧版仅改 content 时同步回写，
    # 否则搜索与摘要会读到旧值
    if request.body is not None:
        note.plain_text = extract_plain_text(request.body)
    elif request.content is not None:
        note.plain_text = request.content or None
    # 出边仅随 body 变化重建；未传 body 时保持原有链接
    if request.body is not None:
        await rebuild_outgoing_links(db, note.id, note.body)

    await db.flush()
    return await _reload_note(db, note.id)


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_note(
    db: AsyncSession, note_id: uuid.UUID, owner_id: uuid.UUID
) -> bool:
    user_id = owner_id
    note = await get_note(db, note_id, user_id)
    if not note:
        return False

    await _require_manage_permission(db, note, user_id, "删除")

    # 先清文件夹关联，避免留下孤儿关联行
    await db.execute(
        delete(NoteFolderMembership).where(
            NoteFolderMembership.note_id == note_id
        )
    )
    await db.delete(note)
    await db.flush()
    return True


# ── 全部获取 ──────────────────────────────────────────────────────────


async def list_all_notes(db: AsyncSession, owner_id: uuid.UUID) -> list[Note]:
    """获取用户可见的所有笔记"""
    user_id = owner_id
    visibility_cond = build_visibility_filter(Note, user_id)
    result = await db.execute(
        select(Note)
        .where(visibility_cond)
        .order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    )
    return list(result.scalars().all())


async def list_tag_counts(
    db: AsyncSession, owner_id: uuid.UUID
) -> list[tuple[str, int]]:
    """统计当前用户可见笔记的标签使用次数，按次数降序（同次数按标签名）。"""
    notes = await list_all_notes(db, owner_id)
    counter: dict[str, int] = {}
    for note in notes:
        for tag in note.tags or []:
            counter[tag] = counter.get(tag, 0) + 1
    return sorted(counter.items(), key=lambda item: (-item[1], item[0]))

