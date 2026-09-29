"""笔记文件夹服务：文件夹 CRUD 与笔记—文件夹多对多关联。"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.note_folder import NoteFolder, NoteFolderMembership
from app.schemas.note_folder import NoteFolderCreate, NoteFolderUpdate
from app.services.note import _require_manage_permission, get_note
from app.services.visibility import check_visibility as build_visibility_filter


# ── 文件夹列表 ────────────────────────────────────────────────────────


async def list_folders(db: AsyncSession, user_id: uuid.UUID) -> list[NoteFolder]:
    """当前用户可见的文件夹，按显示顺序再按名称排序。"""
    cond = build_visibility_filter(NoteFolder, user_id)
    result = await db.execute(
        select(NoteFolder)
        .where(cond)
        .order_by(NoteFolder.sort_order, NoteFolder.name)
    )
    return list(result.scalars().all())


async def list_folder_note_counts(
    db: AsyncSession, user_id: uuid.UUID
) -> dict[uuid.UUID, int]:
    """统计每个文件夹下当前用户可见的笔记数，用于列表展示计数。"""
    result = await db.execute(
        select(NoteFolderMembership.folder_id, func.count(Note.id))
        .join(Note, Note.id == NoteFolderMembership.note_id)
        .where(build_visibility_filter(Note, user_id))
        .group_by(NoteFolderMembership.folder_id)
    )
    return dict(result.all())


# ── 获取（含可见性检查）─────────────────────────────────────────────


async def get_folder(
    db: AsyncSession, folder_id: uuid.UUID, user_id: uuid.UUID
) -> NoteFolder | None:
    """取可见文件夹；不存在或不可见一律返回 None（调用方按 404 处理）。"""
    result = await db.execute(
        select(NoteFolder).where(
            NoteFolder.id == folder_id,
            build_visibility_filter(NoteFolder, user_id),
        )
    )
    return result.scalar_one_or_none()


# ── 创建 ──────────────────────────────────────────────────────────────


async def create_folder(
    db: AsyncSession, owner_id: uuid.UUID, request: NoteFolderCreate
) -> NoteFolder:
    folder = NoteFolder(
        name=request.name.strip(),
        description=request.description,
        sort_order=request.sort_order,
        owner_id=owner_id,
    )
    db.add(folder)
    await db.flush()
    await db.refresh(folder)
    return folder


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_folder(
    db: AsyncSession,
    folder_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: NoteFolderUpdate,
) -> NoteFolder | None:
    folder = await get_folder(db, folder_id, owner_id)
    if not folder:
        return None

    await _require_manage_permission(db, folder, owner_id, "修改")

    if request.name is not None:
        folder.name = request.name.strip()
    if request.description is not None:
        folder.description = request.description
    if request.sort_order is not None:
        folder.sort_order = request.sort_order

    await db.flush()
    await db.refresh(folder)
    return folder


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_folder(
    db: AsyncSession, folder_id: uuid.UUID, owner_id: uuid.UUID
) -> bool:
    """删除文件夹；关联记录随 memberships 级联清除，笔记本身不受影响。"""
    folder = await get_folder(db, folder_id, owner_id)
    if not folder:
        return False

    await _require_manage_permission(db, folder, owner_id, "删除")

    await db.delete(folder)
    await db.flush()
    return True


# ── 笔记—文件夹关联 ─────────────────────────────────────────────────


async def list_note_folders(
    db: AsyncSession, note_id: uuid.UUID, user_id: uuid.UUID
) -> list[NoteFolder]:
    """某笔记所属的可见文件夹。"""
    cond = build_visibility_filter(NoteFolder, user_id)
    result = await db.execute(
        select(NoteFolder)
        .join(NoteFolderMembership, NoteFolderMembership.folder_id == NoteFolder.id)
        .where(NoteFolderMembership.note_id == note_id, cond)
        .order_by(NoteFolder.name)
    )
    return list(result.scalars().all())


async def set_note_folders(
    db: AsyncSession,
    note_id: uuid.UUID,
    owner_id: uuid.UUID,
    folder_ids: list[uuid.UUID],
) -> Note | None:
    """全量替换笔记的文件夹归属。

    传入的每个文件夹 id 必须对当前用户可见且可管理，否则抛 400；
    重复 id 按出现顺序去重；传入空列表表示把笔记移出全部文件夹
    （即成为顶级笔记）。
    """
    note = await get_note(db, note_id, owner_id)
    if not note:
        return None

    await _require_manage_permission(db, note, owner_id, "修改")

    unique_ids = list(dict.fromkeys(folder_ids))
    for folder_id in unique_ids:
        folder = await get_folder(db, folder_id, owner_id)
        if folder is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件夹不存在或无权访问",
            )
        await _require_manage_permission(db, folder, owner_id, "关联")

    await db.execute(
        delete(NoteFolderMembership).where(
            NoteFolderMembership.note_id == note_id
        )
    )
    for folder_id in unique_ids:
        db.add(NoteFolderMembership(note_id=note_id, folder_id=folder_id))

    await db.flush()
    # 重新查询以加载 folders 关系。必须带 populate_existing：会话身份映射里
    # 已缓存该实例，普通 select 会直接返回旧对象而不重新执行 selectin 加载，
    # 导致 folders 仍是替换前的空列表
    result = await db.execute(
        select(Note)
        .where(Note.id == note_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()
