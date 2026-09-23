"""认证相关 Schema。"""

import uuid
from datetime import datetime
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


class LoginResponse(BaseModel):
    """登录响应：无 2FA 时直接返回令牌；有 2FA 时返回 pending 令牌进入第二步。"""

    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    pending_2fa: bool = False
    pending_token: str | None = None
    # 除本次登录外，「其他设备」（device_token 不同）当前在线的会话数。0 表示没有其他设备登录。
    other_session_count: int = 0
    # 因「允许多处登录」关闭而被本次登录下线的会话总数（含同一浏览器遗留的旧会话）。
    # 0 表示未触发单设备策略。
    revoked_session_count: int = 0


class Verify2FARequest(BaseModel):
    """二次验证请求（动态码或恢复码）。"""

    pending_token: str
    code: str


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
    email: str | None = None
    phone: str | None = None
    gender: str | None = None
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


# ---------------------------------------------------------------------------
# 双因素认证（2FA）管理
# ---------------------------------------------------------------------------


class TwoFASetupRequest(BaseModel):
    """创建新的待绑定 TOTP 设备。"""

    password: str
    label: str | None = None


class TwoFAActivateRequest(BaseModel):
    """激活待绑定设备（校验动态码）。"""

    device_id: uuid.UUID
    code: str


class TwoFADeviceResponse(BaseModel):
    """TOTP 设备信息（不返回密钥）。"""

    id: uuid.UUID
    label: str
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None = None


class TwoFARecoveryCodesRequest(BaseModel):
    """重新生成恢复码。"""

    password: str


class TwoFARemoveDeviceRequest(BaseModel):
    """删除认证器设备。"""

    password: str


class TwoFAStatusResponse(BaseModel):
    """当前用户 2FA 状态。"""

    enabled: bool
    device_count: int
    recovery_codes_remaining: int


# ── WebAuthn 相关 Schema ──

class WebAuthnRegisterStartRequest(BaseModel):
    """发起 WebAuthn 注册：返回 challenge 和 rp 配置。"""

    label: str = "认证器"


class WebAuthnRegisterStartResponse(BaseModel):
    """WebAuthn 注册配置（发给浏览器）。"""

    challenge: str
    rp: dict
    user: dict
    pub_key_cred_params: list[dict]
    timeout: int = 60000


class WebAuthnRegisterFinishRequest(BaseModel):
    """完成 WebAuthn 注册：浏览器返回凭据数据。"""

    credential_id: str
    raw_id: str
    response: dict
    client_json: str
    label: str = "认证器"


class WebAuthnAuthStartRequest(BaseModel):
    """发起 WebAuthn 认证：返回 challenge。"""

    # 可选：指定凭据 ID 范围
    credential_ids: list[str] | None = None


class WebAuthnAuthStartResponse(BaseModel):
    """WebAuthn 认证配置。"""

    challenge: str
    rp_id: str | None = None
    timeout: int = 60000
    allow_credentials: list[str] = []
    user_verification: str = "preferred"


class WebAuthnAuthFinishRequest(BaseModel):
    """完成 WebAuthn 认证：浏览器返回签名数据。"""

    credential_id: str
    raw_id: str
    response: dict
    client_json: str


class WebAuthnCredentialResponse(BaseModel):
    """WebAuthn 凭据信息。"""

    id: str
    credential_id: str
    label: str
    transports: str | None
    created_at: datetime
    last_used_at: datetime | None


class WebAuthnVerifyLoginRequest(BaseModel):
    """WebAuthn 登录验证请求。"""

    pending_token: str
    credential_id: str
    raw_id: str
    response: dict
    client_json: str
