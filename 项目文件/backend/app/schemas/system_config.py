"""系统配置 Pydantic 模型"""

from __future__ import annotations

from pydantic import BaseModel


class SystemConfigResponse(BaseModel):
    """系统配置响应"""

    key: str
    value: dict


class SystemConfigUpdate(BaseModel):
    """更新系统配置请求"""

    value: dict
