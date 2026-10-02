"""备份相关数据模型"""

from __future__ import annotations

from pydantic import BaseModel


class BackupInfo(BaseModel):
    """备份信息。

    checksum / table_count / file_count / backup_version 仅在创建备份时返回；
    列表接口不读取 ZIP 内部内容，这些字段为空。
    """

    filename: str
    size: int
    created_at: str
    checksum: str | None = None
    table_count: int | None = None
    file_count: int | None = None
    backup_version: str | None = None


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


class RestoreRequest(BaseModel):
    """恢复请求。

    password 是管理员登录密码，用作恢复动作的授权闸门（二次验证），
    并非备份包解密密钥。
    """

    filename: str
    password: str


class RestoreResult(BaseModel):
    """恢复结果"""

    restored_from: str
    restored_at: str
    table_count: int | None = None
    file_count: int | None = None
    backup_version: str | None = None
