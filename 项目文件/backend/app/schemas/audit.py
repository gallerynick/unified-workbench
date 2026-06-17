"""审计日志 Pydantic 模型"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    """单条审计日志响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    action: str
    target_type: str
    target_id: str
    detail: dict | None = None
    ip: str | None = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    """审计日志列表响应（分页）"""

    items: list[AuditLogResponse]
    total: int
