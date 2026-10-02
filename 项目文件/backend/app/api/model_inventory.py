"""模型清单 API

边界约定：与 api/storage.py 一致 —— 只返回实时采样数据，不做任何持久化。

仅管理员可访问：模型清单含绝对路径、仓库 ID、配置槽位等运维信息，
普通成员无查看必要。位置放在系统设置页。

路由无尾斜杠，与 /system/monitor、/system/status、/system/storage-breakdown 一致。

本端点是唯一数据源：模型配置页与本清单共用同一批采集结果，口径不会分裂。
管理动作（下载 / 删除）仍由第三方配置页持有，本端点只读。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.model_inventory import ModelInventory
from app.services.model_inventory import build_model_inventory

router = APIRouter(tags=["模型清单"])

# 与 api/storage.py、api/monitor.py 共用同款 Bearer 解析器（auto_error=False，
# 401 交由前端处理）
_bearer = HTTPBearer(auto_error=False)


@router.get("/system/model-inventory", response_model=UnifiedResponse[ModelInventory])
async def api_system_model_inventory(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[ModelInventory]:
    """模型清单：聚合 Ollama 与 ModelScope 已下载的模型，按引擎与用途类型给出体积与配置状态。"""
    return UnifiedResponse(data=await build_model_inventory(db))
