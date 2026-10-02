"""备份 API 路由"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import verify_password
from app.models.user import User, UserRole
from app.schemas.backup import (
    BackupInfo,
    BackupListResponse,
    RestoreRequest,
    RestoreResult,
)
from app.schemas.common import UnifiedResponse
from app.services.backup import create_backup, delete_backup, list_backups, restore_backup

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[BackupInfo])
async def create_backup_endpoint(
    current_user=Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """创建备份（仅管理员）。返回备份文件名、大小、创建时间与完整性校验和。"""
    try:
        info = await create_backup()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return UnifiedResponse(data=BackupInfo(**info))


@router.get("/", response_model=UnifiedResponse[BackupListResponse])
async def list_backups_endpoint(
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    """列出备份（仅管理员）"""
    backups = list_backups()
    return UnifiedResponse(data=BackupListResponse(
        items=[BackupInfo(**b) for b in backups],
        total=len(backups),
    ))


@router.delete("/{filename}", response_model=UnifiedResponse[None])
async def delete_backup_endpoint(
    filename: str,
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    """删除备份（仅管理员）"""
    if not delete_backup(filename):
        raise HTTPException(status_code=404, detail="备份文件不存在")
    return UnifiedResponse(data=None)


@router.post("/restore", response_model=UnifiedResponse[RestoreResult])
async def restore_backup_endpoint(
    request: RestoreRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """恢复备份（仅管理员，需再次输入登录密码作为授权闸门）。

    校验流程：登录密码 → 备份包 SHA256 → 快照当前库 → DROP/CREATE → pg_restore。
    任一步失败自动回退到恢复前状态。
    """
    if not verify_password(request.password, current_user.password_hash):
        raise HTTPException(status_code=403, detail="密码验证失败，恢复已取消")
    try:
        result = await restore_backup(request.filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="备份文件不存在")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return UnifiedResponse(data=RestoreResult(**result))
