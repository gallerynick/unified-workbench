"""资源监视 API

边界约定：本端点只返回实时采样数据，不做任何持久化。历史窗口上限由
采样器环形缓冲决定（10 分钟），超出自动裁剪 —— 资源指标是瞬时态，
落库既无审计价值，也会与「审计日志只增不改不删」的语义混淆。

仅管理员可访问：资源明细属运维视角，且含进程名 / 用户名等信息，
普通成员无查看必要。位置放在系统设置页而非用户界面，与
api/status.py 声明的边界约定一致。

路由无尾斜杠，与 /system/status、/system/check-update 保持一致。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.deps import require_admin
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.monitor import MonitorData
from app.services.monitor.sampler import get_sampler

router = APIRouter(tags=["资源监视"])

# 与 api/status.py 共用同款 Bearer 解析器（auto_error=False，401 交由前端处理）
_bearer = HTTPBearer(auto_error=False)


@router.get("/system/monitor", response_model=UnifiedResponse[MonitorData])
async def api_system_monitor(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    admin: User = Depends(require_admin),
    minutes: int = Query(
        default=5, ge=1, le=10, description="历史窗口（分钟），上限受环形缓冲限制"
    ),
    processes: int = Query(default=20, ge=1, le=50, description="进程列表条数"),
) -> UnifiedResponse[MonitorData]:
    """运行环境资源监视：快照 + 压力分析 + 进程 Top + 历史曲线。"""
    data = get_sampler().payload(minutes=minutes, top=processes)
    return UnifiedResponse(data=MonitorData.model_validate(data))
