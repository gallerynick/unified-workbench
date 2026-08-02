"""文件分享 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator


class ShareResponse(BaseModel):
    """分享详情响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_name: str
    file_size: int
    mime_type: str | None = None
    share_code: str
    has_password: bool
    expires_at: str
    max_downloads: int | None = None
    download_count: int
    is_expired: bool
    created_at: str
    deleted_at: str | None = None


class SharePublicInfo(BaseModel):
    """公开分享信息（不含敏感字段）。"""

    model_config = ConfigDict(from_attributes=True)

    share_code: str
    original_name: str
    file_size: int
    mime_type: str | None = None
    has_password: bool
    expires_at: str
    max_downloads: int | None = None
    download_count: int
    is_expired: bool


class SharePasswordVerify(BaseModel):
    """分享密码验证请求。"""

    share_code: str
    password: str


class ShareUpdateRequest(BaseModel):
    """更新分享设置请求。"""

    password: str | None = None
    expires_in_minutes: int | None = None
    expires_in_hours: int | None = None
    expires_in_days: int | None = None
    max_downloads: int | None = None

    @model_validator(mode="after")
    def check_expires_positive(self) -> ShareUpdateRequest:
        for field_name in ("expires_in_minutes", "expires_in_hours", "expires_in_days"):
            val = getattr(self, field_name)
            if val is not None and val <= 0:
                raise ValueError(f"{field_name} 必须大于 0")
        return self


class StorageInfo(BaseModel):
    """存储空间信息。"""

    total_space_gb: float
    used_space_gb: float
    free_space_gb: float
    reserved_space_gb: float


class ReservedSpaceUpdate(BaseModel):
    """更新预留空间请求。"""

    reserved_space_gb: int


class FileShareListResponse(BaseModel):
    """文件分享列表响应。"""

    items: list[ShareResponse]
    total: int
