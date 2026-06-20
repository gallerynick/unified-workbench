"""备份 API 路由"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import UserRole
from app.schemas.backup import BackupInfo, BackupListResponse
from app.schemas.common import UnifiedResponse
from app.services.backup import create_backup, delete_backup, list_backups, restore_backup

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[BackupInfo])
async def create_backup_endpoint(
    current_user=Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """创建备份（仅管理员）"""
    filepath = await create_backup()
    f = Path(filepath)
    return UnifiedResponse(data=BackupInfo(
        filename=f.name,
        size=f.stat().st_size,
        created_at=datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
    ))


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


@router.post("/restore", response_model=UnifiedResponse[None])
async def restore_backup_endpoint(
    filename: str,
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    """恢复备份（仅管理员）"""
    try:
        await restore_backup(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="备份文件不存在")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return UnifiedResponse(data=None)
