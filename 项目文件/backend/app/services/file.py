"""文件业务逻辑"""

from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.permissions import check_visibility
from app.models.file import File
from app.models.folder import Folder
from app.models.user import User, UserRole
from app.services.audit import log_audit
from app.services.notification.event_trigger import trigger_event_reminders
from app.utils.thumbnail import generate_thumbnail

IMAGE_MIME_PREFIXES = ("image/jpeg", "image/png", "image/gif", "image/webp")


def _is_image(mime_type: str) -> bool:
    return mime_type.startswith(IMAGE_MIME_PREFIXES)


def _build_stored_path(file_id: uuid.UUID, original_name: str) -> str:
    settings = get_settings()
    now = datetime.now()
    ext = os.path.splitext(original_name)[1].lower()
    return os.path.join(
        settings.NAS_FILES_PATH,
        now.strftime("%Y"),
        now.strftime("%m"),
        f"{file_id}{ext}",
    )


def _build_thumbnail_path(file_id: uuid.UUID) -> str:
    settings = get_settings()
    return os.path.join(settings.NAS_FILES_PATH, "thumbnails", f"{file_id}_thumb.jpg")


async def _stream_to_disk(
    upload_file: UploadFile, dest_path: str
) -> tuple[int, str]:
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    sha256_hash = hashlib.sha256()
    total_size = 0
    with open(dest_path, "wb") as f:
        while chunk := await upload_file.read(8192):
            f.write(chunk)
            sha256_hash.update(chunk)
            total_size += len(chunk)
    return total_size, sha256_hash.hexdigest()


async def upload_file(
    db: AsyncSession,
    file: UploadFile,
    current_user: User,
    folder_id: uuid.UUID | None = None,
    visibility: str = "private",
    restricted_users: list[str] | None = None,
    restricted_tags: list[str] | None = None,
    expires_at: datetime | None = None,
) -> File:
    settings = get_settings()
    mime_type = file.content_type or "application/octet-stream"
    max_size = (
        settings.MAX_IMAGE_SIZE if _is_image(mime_type) else settings.MAX_FILE_SIZE
    )

    file_id = uuid.uuid4()
    stored_path = _build_stored_path(file_id, file.filename or "unnamed")

    total_size, sha256 = await _stream_to_disk(file, stored_path)

    if total_size > max_size:
        os.remove(stored_path)
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"文件大小超过限制（最大 {max_size // (1024 * 1024)}MB）",
        )

    existing = await db.execute(select(File).where(File.sha256 == sha256))
    dup = existing.scalar_one_or_none()
    if dup:
        os.remove(stored_path)
        await log_audit(db, current_user.id, "upload_file", "file", str(dup.id))
        return dup

    if _is_image(mime_type):
        thumb_path = _build_thumbnail_path(file_id)
        try:
            await generate_thumbnail(stored_path, thumb_path, settings.THUMBNAIL_SIZE)
        except Exception:
            pass

    # 如果指定了文件夹，检查是否启用统一管理
    if folder_id is not None:
        folder_result = await db.execute(select(Folder).where(Folder.id == folder_id))
        folder = folder_result.scalar_one_or_none()
        if folder and folder.unified_management:
            visibility = folder.visibility
            restricted_users = folder.restricted_users
            restricted_tags = folder.restricted_tags
            expires_at = folder.expires_at

    db_file = File(
        id=file_id,
        name=file.filename or "unnamed",
        stored_path=stored_path,
        size=total_size,
        sha256=sha256,
        mime_type=mime_type,
        folder_id=folder_id,
        owner_id=current_user.id,
        visibility=visibility,
        restricted_users=restricted_users,
        restricted_tags=restricted_tags,
        expires_at=expires_at,
    )
    db.add(db_file)
    await db.flush()
    await log_audit(db, current_user.id, "upload_file", "file", str(file_id))
    return db_file


async def download_file(
    db: AsyncSession, file_id: uuid.UUID, current_user: User
) -> File:
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    restricted_user_ids = (
        {uuid.UUID(uid) for uid in file.restricted_users}
        if file.restricted_users
        else None
    )
    restricted_tag_set = set(file.restricted_tags) if file.restricted_tags else None

    if not check_visibility(
        current_user,
        file.visibility,
        file.owner_id,
        restricted_user_ids,
        restricted_tag_set,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该文件")

    return file


async def delete_file(
    db: AsyncSession, file_id: uuid.UUID, current_user: User
) -> None:
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    if file.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者或管理员可删除")

    if os.path.exists(file.stored_path):
        os.remove(file.stored_path)
    thumb_path = _build_thumbnail_path(file_id)
    if os.path.exists(thumb_path):
        os.remove(thumb_path)

    await db.delete(file)
    await db.flush()
    await log_audit(db, current_user.id, "delete_file", "file", str(file_id))
    await trigger_event_reminders(db, "file_delete", {
        "file_id": str(file.id),
        "file_name": file.name,
        "user_id": str(current_user.id),
    })


async def list_files(
    db: AsyncSession,
    current_user: User,
    folder_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[File], int]:
    query = select(File)

    if folder_id is not None:
        query = query.where(File.folder_id == folder_id)

    if current_user.role != UserRole.ADMIN:
        vis_filter = (
            (File.visibility == "public")
            | (File.visibility == "restricted")
            | (File.owner_id == current_user.id)
        )
        query = query.where(vis_filter)

    query = query.order_by(File.created_at.desc())
    result = await db.execute(query)
    all_files = list(result.scalars().all())

    if current_user.role != UserRole.ADMIN:
        visible = []
        for f in all_files:
            if f.visibility == "restricted":
                r_users = (
                    {uuid.UUID(uid) for uid in f.restricted_users}
                    if f.restricted_users
                    else set()
                )
                r_tags = set(f.restricted_tags) if f.restricted_tags else set()
                if check_visibility(
                    current_user, f.visibility, f.owner_id, r_users, r_tags
                ):
                    visible.append(f)
            else:
                visible.append(f)
        all_files = visible

    total = len(all_files)
    start = (page - 1) * page_size
    return all_files[start : start + page_size], total


async def create_folder(
    db: AsyncSession,
    name: str,
    current_user: User,
    parent_id: uuid.UUID | None = None,
) -> Folder:
    if parent_id is not None:
        parent_result = await db.execute(select(Folder).where(Folder.id == parent_id))
        if not parent_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="父文件夹不存在"
            )

    folder = Folder(
        name=name,
        parent_id=parent_id,
        owner_id=current_user.id,
    )
    db.add(folder)
    await db.flush()
    await log_audit(db, current_user.id, "create_folder", "folder", str(folder.id))
    return folder


async def list_folders(
    db: AsyncSession,
    current_user: User,
    parent_id: uuid.UUID | None = None,
) -> list[Folder]:
    query = select(Folder)
    if parent_id is not None:
        query = query.where(Folder.parent_id == parent_id)
    else:
        query = query.where(Folder.parent_id.is_(None))
    query = query.order_by(Folder.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def delete_folder(
    db: AsyncSession, folder_id: uuid.UUID, current_user: User
) -> None:
    result = await db.execute(select(Folder).where(Folder.id == folder_id))
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")

    if folder.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者或管理员可删除")

    # 将子文件夹的 parent_id 置为 NULL（移至根目录）
    await db.execute(
        update(Folder).where(Folder.parent_id == folder_id).values(parent_id=None)
    )
    # 将文件的 folder_id 置为 NULL（移至根目录）
    await db.execute(
        update(File).where(File.folder_id == folder_id).values(folder_id=None)
    )

    await db.delete(folder)
    await db.flush()
    await log_audit(db, current_user.id, "delete_folder", "folder", str(folder_id))


async def update_file(
    db: AsyncSession,
    file_id: uuid.UUID,
    data: dict,
    current_user: User,
) -> File:
    """更新文件属性"""
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    if file.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者或管理员可修改")

    if file.folder_id is not None and current_user.role != UserRole.ADMIN:
        folder_result = await db.execute(select(Folder).where(Folder.id == file.folder_id))
        folder = folder_result.scalar_one_or_none()
        if folder and folder.unified_management:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="该文件受文件夹统一管理，无法单独修改",
            )

    for key, value in data.items():
        if hasattr(file, key):
            setattr(file, key, value)

    await db.flush()
    await log_audit(db, current_user.id, "update_file", "file", str(file_id))
    return file


async def update_folder(
    db: AsyncSession,
    folder_id: uuid.UUID,
    data: dict,
    current_user: User,
) -> Folder:
    """更新文件夹属性"""
    result = await db.execute(select(Folder).where(Folder.id == folder_id))
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")

    if folder.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者或管理员可修改")

    # 检查 unified_management 是否变更
    old_unified = folder.unified_management
    new_unified = data.get("unified_management")

    for key, value in data.items():
        if hasattr(folder, key):
            setattr(folder, key, value)

    # 如果 unified_management 为 True，同步设置到子文件（无论之前状态如何）
    if new_unified is True:
        sync_fields = {}
        if "visibility" in data:
            sync_fields["visibility"] = data["visibility"]
        if "restricted_users" in data:
            sync_fields["restricted_users"] = data["restricted_users"]
        if "restricted_tags" in data:
            sync_fields["restricted_tags"] = data["restricted_tags"]
        if "expires_at" in data:
            sync_fields["expires_at"] = data["expires_at"]

        if sync_fields:
            await db.execute(
                update(File).where(File.folder_id == folder_id).values(**sync_fields)
            )

    await db.flush()
    await log_audit(db, current_user.id, "update_folder", "folder", str(folder_id))
    return folder
