"""认证相关 Schema。"""

import re
from typing import ClassVar

from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    """登录请求。"""

    username: str
    password: str


class TokenResponse(BaseModel):
    """令牌响应。"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """刷新令牌请求。"""

    refresh_token: str


class PasswordChangeRequest(BaseModel):
    """修改密码请求。"""

    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """验证密码强度：至少 8 位，必须包含字母和数字。"""
        if len(v) < 8:
            raise ValueError("密码长度至少 8 位")
        has_letter = any(c.isalpha() for c in v)
        has_digit = any(c.isdigit() for c in v)
        if not (has_letter and has_digit):
            raise ValueError("密码必须包含字母和数字")
        return v


class PasswordVerifyRequest(BaseModel):
    """密码验证请求（用于查看密钥等敏感操作）。"""

    password: str


class ProfileUpdateRequest(BaseModel):
    """个人资料更新请求。"""

    AVATAR_MAX_BYTES: ClassVar[int] = 5 * 1024 * 1024

    nickname: str | None = None
    avatar: str | None = None

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not isinstance(v, str) or not v.strip():
            raise ValueError("头像数据无效")
        if not v.startswith("data:image/"):
            raise ValueError("头像必须是有效的 base64 图片数据（data:image/...）")
        if "image/svg+xml" in v:
            raise ValueError("不支持 SVG 格式的头像")
        if len(v) > cls.AVATAR_MAX_BYTES:
            raise ValueError(f"头像数据过大（最大 {cls.AVATAR_MAX_BYTES // (1024 * 1024)}MB）")
        return v
