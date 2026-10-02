"""用户相关 Schema。"""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from sqlalchemy import inspect

from app.models.user import UserRole, UserStatus


class TagResponse(BaseModel):
    """标签响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str | None


class UserResponse(BaseModel):
    """用户响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    nickname: str
    email: str | None = None
    phone: str | None = None
    gender: str | None = None
    avatar: str | None
    role: UserRole
    status: UserStatus
    tags: list[TagResponse] = []
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def handle_lazy_tags(cls, data):
        """处理未预加载的 tags 关系。

        关键：先检查 loaded 状态，而不是直接访问 data.tags。在 async SQLAlchemy 下，
        对未加载关系的访问会触发惰性加载（greenlet_spawn 错误），并把当前 session
        事务置为 rollback-pending，随后所有字段的取值都会抛 PendingRollbackError
        （表现为 10 连 validation error）。正确做法是未加载时直接把 tags 置空。
        """
        if hasattr(data, "__dict__"):
            try:
                state = inspect(data)
                if "tags" in state.mapper.relationships:
                    if not state.attrs["tags"].loaded:
                        data.__dict__["tags"] = []
            except Exception:
                data.__dict__["tags"] = []
        return data


class UserCreateRequest(BaseModel):
    """创建用户请求。"""

    username: str
    password: str
    nickname: str
    role: UserRole = UserRole.MEMBER
    tags: list[uuid.UUID] = []

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        """验证用户名：只允许英文字母、数字、下划线、连字符，不允许中文。"""
        if not v or not v.strip():
            raise ValueError("用户名不能为空")
        v = v.strip()
        if len(v) < 3:
            raise ValueError("用户名长度至少 3 个字符")
        if len(v) > 50:
            raise ValueError("用户名长度不能超过 50 个字符")
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError("用户名只允许英文字母、数字、下划线(_)和连字符(-)，不允许中文或特殊字符")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """验证密码强度：至少 8 位，必须包含字母和数字。"""
        if len(v) < 8:
            raise ValueError("密码长度至少 8 位")
        has_letter = any(c.isalpha() for c in v)
        has_digit = any(c.isdigit() for c in v)
        if not (has_letter and has_digit):
            raise ValueError("密码必须包含字母和数字")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """验证角色：必须是 admin 或 member。"""
        if v not in ("admin", "member"):
            raise ValueError("角色必须是 admin 或 member")
        return v


class UserUpdateRequest(BaseModel):
    """更新用户请求。"""

    nickname: str | None = None
    email: str | None = None
    phone: str | None = None
    gender: str | None = None
    avatar: str | None = None
    role: str | None = None
    status: str | None = None
    tags: list[uuid.UUID] | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str | None) -> str | None:
        """验证角色：必须是 admin 或 member。"""
        if v is not None and v not in ("admin", "member"):
            raise ValueError("角色必须是 admin 或 member")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        """验证状态：必须是 active 或 disabled。"""
        if v is not None and v not in ("active", "disabled"):
            raise ValueError("状态必须是 active 或 disabled")
        return v


class UserListResponse(BaseModel):
    """用户列表响应。"""

    items: list[UserResponse]
    total: int
