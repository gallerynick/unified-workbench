"""文件分享业务逻辑 — 上传、下载、密码验证、磁盘检查。"""

from __future__ import annotations

import os
import secrets
import string
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.file_share import FileShare
from app.models.user import User, UserRole

settings = get_settings()


def _generate_share_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(8))


async def check_disk_space() -> tuple[float, float, float]:
    path = Path(settings.FILE_STORAGE_PATH)
    path.mkdir(parents=True, exist_ok=True)
    stat = os.statvfs(str(path))
    total = stat.f_frsize * stat.f_blocks / (1024**3)
    free = stat.f_frsize * stat.f_bavail / (1024**3)
    used = total - free
    return total, used, free


async def upload_file_share(
    db: AsyncSession,
    file: UploadFile,
    password: str | None,
    expires_in_minutes: int = 0,
    expires_in_hours: int = 0,
    expires_in_days: int = 0,
    max_downloads: int | None = None,
    current_user: User | None = None,
) -> FileShare:
    # 预检查磁盘空间
    _, _, free_gb = await check_disk_space()
    if free_gb < settings.RESERVED_DISK_SPACE_GB:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="磁盘空间不足，无法上传文件",
        )

    original_name = file.filename or "unnamed"
    ext = os.path.splitext(original_name)[1].lower()
    file_uuid = uuid.uuid4()
    stored_name = f"{file_uuid}{ext}"

    now = datetime.now(UTC)
    date_dir = Path(settings.FILE_STORAGE_PATH) / now.strftime("%Y") / now.strftime("%m")
    date_dir.mkdir(parents=True, exist_ok=True)
    dest_path = date_dir / stored_name

    try:
        with open(dest_path, "wb") as f:
            while chunk := await file.read(8192):
                f.write(chunk)
    except Exception:
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="文件写入失败",
        )

    actual_size = dest_path.stat().st_size
    actual_size_gb = actual_size / (1024**3)
    if actual_size_gb > settings.MAX_SHARE_FILE_SIZE_GB:
        dest_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"文件大小超过限制（最大 {settings.MAX_SHARE_FILE_SIZE_GB}GB）",
        )

    _, _, free_after = await check_disk_space()
    if free_after < settings.RESERVED_DISK_SPACE_GB:
        dest_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="写入后磁盘空间不足",
        )

    share_code = _generate_share_code()
    expires_at = now + timedelta(
        minutes=expires_in_minutes,
        hours=expires_in_hours,
        days=expires_in_days,
    )
    password_hash_val = hash_password(password) if password else None

    share = FileShare(
        id=file_uuid,
        original_name=original_name,
        stored_name=stored_name,
        file_path=str(dest_path),
        file_size=actual_size,
        mime_type=file.content_type or "application/octet-stream",
        share_code=share_code,
        password_hash=password_hash_val,
        expires_at=expires_at,
        max_downloads=max_downloads,
        download_count=0,
        is_deleted=False,
        owner_id=current_user.id if current_user else None,
    )

    from sqlalchemy.exc import IntegrityError

    max_retries = 5
    for attempt in range(max_retries):
        try:
            db.add(share)
            await db.flush()
            break
        except IntegrityError:
            await db.rollback()
            if attempt == max_retries - 1:
                dest_path.unlink()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="生成分享码失败，请重试",
                )
            share_code = _generate_share_code()
            share.share_code = share_code

    return share


async def get_share_by_code(db: AsyncSession, share_code: str) -> FileShare | None:
    result = await db.execute(
        select(FileShare).where(
            FileShare.share_code == share_code,
            ~FileShare.is_deleted,
        )
    )
    share = result.scalar_one_or_none()
    if share and share.expires_at < datetime.now(UTC):
        share.is_deleted = True
        await db.commit()
        return None
    if share and share.max_downloads is not None and share.download_count >= share.max_downloads:
        return None
    return share


async def verify_share_password(db: AsyncSession, share_code: str, password: str) -> bool:
    share = await get_share_by_code(db, share_code)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享不存在或已过期",
        )
    if not share.password_hash:
        return True
    return verify_password(password, share.password_hash)


async def download_share(db: AsyncSession, share_code: str) -> tuple[str, str, str | None]:
    share = await get_share_by_code(db, share_code)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享不存在或已过期",
        )
    if not os.path.exists(share.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在，可能已被清理",
        )
    share.download_count += 1
    await db.commit()
    return share.file_path, share.original_name, share.mime_type


async def list_user_shares(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[FileShare], int]:
    base_stmt = select(FileShare).where(
        FileShare.owner_id == current_user.id,
        ~FileShare.is_deleted,
    )

    count_result = await db.execute(
        select(func.count()).select_from(base_stmt.subquery())
    )
    total = count_result.scalar() or 0

    query = (
        base_stmt.order_by(FileShare.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    shares = list(result.scalars().all())
    return shares, total


async def get_share_detail(
    db: AsyncSession,
    share_id: uuid.UUID,
    current_user: User,
) -> FileShare:
    result = await db.execute(
        select(FileShare).where(
            FileShare.id == share_id,
            ~FileShare.is_deleted,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享不存在",
        )
    if share.owner_id and share.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    return share


async def delete_share(
    db: AsyncSession,
    share_id: uuid.UUID,
    current_user: User,
) -> None:
    result = await db.execute(
        select(FileShare).where(
            FileShare.id == share_id,
            ~FileShare.is_deleted,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享不存在",
        )
    if share.owner_id and share.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    share.is_deleted = True
    await db.commit()


async def update_share_settings(
    db: AsyncSession,
    share_id: uuid.UUID,
    data: dict,
    current_user: User,
) -> FileShare:
    result = await db.execute(
        select(FileShare).where(
            FileShare.id == share_id,
            ~FileShare.is_deleted,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享不存在",
        )
    if share.owner_id and share.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )

    if "password" in data and data["password"] is not None:
        share.password_hash = hash_password(data["password"])

    if (
        data.get("expires_in_minutes") is not None
        or data.get("expires_in_hours") is not None
        or data.get("expires_in_days") is not None
    ):
        minutes = data.get("expires_in_minutes", 0) or 0
        hours = data.get("expires_in_hours", 0) or 0
        days = data.get("expires_in_days", 0) or 0
        share.expires_at = datetime.now(UTC) + timedelta(
            minutes=minutes,
            hours=hours,
            days=days,
        )

    if "max_downloads" in data and data["max_downloads"] is not None:
        share.max_downloads = data["max_downloads"]

    await db.commit()
    await db.refresh(share)
    return share


async def get_storage_info(db: AsyncSession) -> dict:
    total_gb, used_gb, free_gb = await check_disk_space()
    return {
        "total_space_gb": round(total_gb, 2),
        "used_space_gb": round(used_gb, 2),
        "free_space_gb": round(free_gb, 2),
        "reserved_space_gb": settings.RESERVED_DISK_SPACE_GB,
    }
