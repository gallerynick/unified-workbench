"""用户通知配置 Pydantic 模型"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import MAX_PORT


class UserNotificationConfigResponse(BaseModel):
    """用户通知配置响应"""

    model_config = ConfigDict(from_attributes=True)

    enabled_channels: list[str] = []
    feishu_webhook_url: str | None = None
    wecom_webhook_url: str | None = None
    email_enabled: bool = False
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True


class UserNotificationConfigUpdate(BaseModel):
    """用户通知配置更新请求"""

    enabled_channels: list[str] | None = None
    feishu_webhook_url: str | None = Field(default=None, max_length=500)
    wecom_webhook_url: str | None = Field(default=None, max_length=500)
    email_enabled: bool | None = None
    smtp_host: str | None = Field(default=None, max_length=200)
    smtp_port: int | None = Field(default=None, le=MAX_PORT)
    smtp_user: str | None = Field(default=None, max_length=200)
    smtp_password: str | None = Field(default=None, max_length=200)
    smtp_use_tls: bool | None = None
