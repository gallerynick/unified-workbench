"""存储占用分布 API

边界约定：本端点只返回实时采样数据，不做任何持久化 —— 容量指标是瞬时态，
落库既无审计价值，也会与「审计日志只增不改不删」的语义混淆。
与 app/api/monitor.py 的边界约定一致。

仅管理员可访问：存储明细属运维视角，且含绝对路径、模型名等信息，
普通成员无查看必要。位置放在系统设置页而非用户界面，与 api/status.py
声明的边界约定一致。

路由无尾斜杠，与 /system/monitor、/system/status 保持一致。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.storage import StorageBreakdown
from app.services.storage_breakdown import build_storage_breakdown

router = APIRouter(tags=["存储占用"])

# 与 api/monitor.py、api/status.py 共用同款 Bearer 解析器（auto_error=False，
# 401 交由前端处理）
_bearer = HTTPBearer(auto_error=False)


@router.get("/system/storage-breakdown", response_model=UnifiedResponse[StorageBreakdown])
async def api_system_storage_breakdown(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[StorageBreakdown]:
    """存储占用分布：按业务分类统计，无法分解的部分归入「其他」并附说明。"""
    return UnifiedResponse(data=await build_storage_breakdown(db))

