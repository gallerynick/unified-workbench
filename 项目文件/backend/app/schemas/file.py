"""文件 Pydantic 模型"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    stored_path: str
    size: int
    sha256: str
    mime_type: str
    folder_id: uuid.UUID | None = None
    owner_id: uuid.UUID
    visibility: str
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    expires_at: datetime | None = None
    created_at: datetime


class FileListResponse(BaseModel):
    items: list[FileResponse]
    total: int


class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None = None
    owner_id: uuid.UUID
    visibility: str = "private"
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    expires_at: datetime | None = None
    unified_management: bool = False
    created_at: datetime


class FolderCreateRequest(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None


class FileUpdateRequest(BaseModel):
    """文件更新请求"""
    expires_at: datetime | None = None


class FolderUpdateRequest(BaseModel):
    """文件夹更新请求"""
    name: str | None = None
    visibility: str | None = None
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    expires_at: datetime | None = None
    unified_management: bool | None = None
