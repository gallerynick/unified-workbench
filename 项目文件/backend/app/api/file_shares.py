"""文件分享 API 路由 — 上传、下载、密码验证、管理。"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.file_share import FileShare
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.file_share import (
    FileShareListResponse,
    ReservedSpaceUpdate,
    SharePasswordVerify,
    SharePublicInfo,
    ShareResponse,
    ShareUpdateRequest,
    StorageInfo,
)
from app.services import file_share as fs

settings = get_settings()

router = APIRouter()
public_router = APIRouter(prefix="/public/shares", tags=["文件共享（公开）"])


def _build_share_response(share: FileShare) -> ShareResponse:
    return ShareResponse(
        id=share.id,
        original_name=share.original_name,
        file_size=share.file_size,
        mime_type=share.mime_type,
        share_code=share.share_code,
        has_password=share.password_hash is not None,
        expires_at=share.expires_at.isoformat(),
        max_downloads=share.max_downloads,
        download_count=share.download_count,
        created_at=share.created_at,
    )


def _build_public_info(share: FileShare) -> SharePublicInfo:
    return SharePublicInfo(
        share_code=share.share_code,
        original_name=share.original_name,
        file_size=share.file_size,
        mime_type=share.mime_type,
        has_password=share.password_hash is not None,
        expires_at=share.expires_at.isoformat(),
        max_downloads=share.max_downloads,
        download_count=share.download_count,
    )


# ═══════════════════════════════════════════
# 需认证端点
# ═══════════════════════════════════════════

@router.post("/", response_model=UnifiedResponse[ShareResponse])
async def upload_share(
    file: UploadFile = File(...),
    file_name: str = Form(...),
    file_size: int = Form(...),
    mime_type: str | None = Form(None),
    password: str | None = Form(None),
    expires_in_minutes: int = Form(0),
    expires_in_hours: int = Form(0),
    expires_in_days: int = Form(0),
    max_downloads: int | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if (
        expires_in_minutes <= 0
        and expires_in_hours <= 0
        and expires_in_days <= 0
    ):
        return UnifiedResponse(code=1, msg="至少需指定一个过期时间参数（分钟/小时/天）")

    share = await fs.upload_file_share(
        db=db,
        file=file,
        password=password,
        expires_in_minutes=expires_in_minutes,
        expires_in_hours=expires_in_hours,
        expires_in_days=expires_in_days,
        max_downloads=max_downloads,
        current_user=current_user,
    )
    return UnifiedResponse(data=_build_share_response(share))


@router.get("/", response_model=UnifiedResponse[FileShareListResponse])
async def list_my_shares(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shares, total = await fs.list_user_shares(db, current_user, page, page_size)
    items = [_build_share_response(s) for s in shares]
    return UnifiedResponse(data=FileShareListResponse(items=items, total=total))


@router.get("/{share_id}", response_model=UnifiedResponse[ShareResponse])
async def get_share_detail(
    share_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    share = await fs.get_share_detail(db, share_id, current_user)
    return UnifiedResponse(data=_build_share_response(share))


@router.delete("/{share_id}", response_model=UnifiedResponse[None])
async def delete_my_share(
    share_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await fs.delete_share(db, share_id, current_user)
    return UnifiedResponse(msg="分享已删除")


@router.patch("/{share_id}", response_model=UnifiedResponse[ShareResponse])
async def update_share(
    share_id: uuid.UUID,
    request: ShareUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    share = await fs.update_share_settings(
        db,
        share_id,
        request.model_dump(exclude_unset=True),
        current_user,
    )
    return UnifiedResponse(data=_build_share_response(share))


# ═══════════════════════════════════════════
# 公开端点（无需认证）
# ═══════════════════════════════════════════

@public_router.get("/{share_code}")
async def get_public_share_info(
    share_code: str,
    db: AsyncSession = Depends(get_db),
):
    share = await fs.get_share_by_code(db, share_code)
    if not share:
        raise HTTPException(status_code=404, detail="分享不存在或已过期")
    return {"data": _build_public_info(share)}


@public_router.post("/{share_code}/verify")
async def verify_share_password(
    share_code: str,
    body: SharePasswordVerify,
    db: AsyncSession = Depends(get_db),
):
    valid = await fs.verify_share_password(db, share_code, body.password)
    return {"data": {"valid": valid}}


@public_router.get("/{share_code}/download")
async def download_shared_file(
    share_code: str,
    password: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    share = await fs.get_share_by_code(db, share_code)
    if not share:
        raise HTTPException(status_code=404, detail="分享不存在或已过期")
    if share.password_hash is not None:
        if not password:
            raise HTTPException(status_code=403, detail="此分享需要密码")
        valid = await fs.verify_share_password(db, share_code, password)
        if not valid:
            raise HTTPException(status_code=403, detail="密码错误")
    file_path, original_name, mime_type = await fs.download_share(db, share_code)
    return FileResponse(
        path=file_path,
        filename=original_name,
        media_type=mime_type or "application/octet-stream",
    )


# ═══════════════════════════════════════════
# 管理员端点
# ═══════════════════════════════════════════

@router.get("/admin/storage", response_model=UnifiedResponse[StorageInfo])
async def admin_get_storage(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    info = await fs.get_storage_info(db)
    return UnifiedResponse(data=StorageInfo(**info))


@router.put("/admin/storage/reserved-space", response_model=UnifiedResponse[None])
async def admin_update_reserved_space(
    request: ReservedSpaceUpdate,
    _admin: User = Depends(require_admin),
):
    settings.RESERVED_DISK_SPACE_GB = request.reserved_space_gb
    return UnifiedResponse(msg="预留空间已更新")
