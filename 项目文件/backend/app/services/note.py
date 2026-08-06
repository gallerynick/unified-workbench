"""笔记服务"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.note import Note
from app.models.user import User, UserRole
from app.schemas.note import NoteCreate, NoteUpdate
from app.services.visibility import check_visibility as build_visibility_filter


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
    _role_result = await db.execute(
        select(User.role).where(User.id == user_id)
    )
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
    category: str | None = None,
    parent_id: uuid.UUID | None = None,
) -> tuple[list[Note], int]:
    user_id = owner_id
    visibility_cond = build_visibility_filter(Note, user_id)
    query = select(Note).where(visibility_cond)

    if search:
        query = query.where(
            Note.title.ilike(f"%{search}%") | Note.content.ilike(f"%{search}%")
        )
    if category:
        query = query.where(Note.category == category)
    if parent_id is not None:
        query = query.where(Note.parent_id == parent_id)
    else:
        query = query.where(Note.parent_id.is_(None))
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = (
        query.order_by(Note.is_pinned.desc(), Note.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    return list(result.scalars().all()), total


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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权访问"
        )
    return item


# ── 创建（不变）─────────────────────────────────────────────────────


async def create_note(
    db: AsyncSession, owner_id: uuid.UUID, request: NoteCreate
) -> Note:
    note = Note(
        title=request.title,
        content=request.content,
        category=request.category,
        tags=request.tags,
        is_pinned=request.is_pinned,
        parent_id=request.parent_id,
        owner_id=owner_id,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


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
    if request.category is not None:
        note.category = request.category
    if request.tags is not None:
        note.tags = request.tags
    if request.is_pinned is not None:
        note.is_pinned = request.is_pinned
    if request.parent_id is not None:
        note.parent_id = request.parent_id
    await db.flush()
    await db.refresh(note)
    return note


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_note(
    db: AsyncSession, note_id: uuid.UUID, owner_id: uuid.UUID
) -> bool:
    user_id = owner_id
    note = await get_note(db, note_id, user_id)
    if not note:
        return False

    await _require_manage_permission(db, note, user_id, "删除")

    await db.delete(note)
    await db.flush()
    return True


# ── 全部获取 ──────────────────────────────────────────────────────────


async def list_all_notes(
    db: AsyncSession, owner_id: uuid.UUID
) -> list[Note]:
    """获取用户可见的所有笔记"""
    user_id = owner_id
    visibility_cond = build_visibility_filter(Note, user_id)
    result = await db.execute(
        select(Note)
        .where(visibility_cond)
        .order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    )
    return list(result.scalars().all())


# ── 移动 ──────────────────────────────────────────────────────────────


async def move_note(
    db: AsyncSession,
    note_id: uuid.UUID,
    owner_id: uuid.UUID,
    new_parent_id: uuid.UUID | None,
) -> Note | None:
    """移动笔记到新的父节点（需可见性检查 + 循环引用检测）"""
    user_id = owner_id
    note = await get_note(db, note_id, user_id)
    if not note:
        return None

    await _require_manage_permission(db, note, user_id, "移动")

    if new_parent_id is not None:
        if new_parent_id == note_id:
            raise ValueError("不能将笔记移动到自己下面")
        target = await get_note(db, new_parent_id, user_id)
        if not target:
            raise ValueError("目标父笔记不存在")
        # 循环引用检测
        current = target
        while current.parent_id is not None:
            if current.parent_id == note_id:
                raise ValueError("不能将笔记移动到自己的子节点下面")
            current = await get_note(db, current.parent_id, user_id)
            if not current:
                break
    note.parent_id = new_parent_id
    await db.flush()
    await db.refresh(note)
    return note
