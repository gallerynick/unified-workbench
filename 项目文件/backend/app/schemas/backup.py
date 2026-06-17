"""备份相关数据模型"""

from __future__ import annotations

from pydantic import BaseModel


class BackupInfo(BaseModel):
    """备份信息"""
    filename: str
    size: int
    created_at: str


class BackupConfig(BaseModel):
    """备份配置"""
    backup_dir: str = "/data/backups"
    schedule: str = "daily"
    max_backups: int = 7
    enabled: bool = False


class BackupListResponse(BaseModel):
    """备份列表响应"""
    items: list[BackupInfo]
    total: int
