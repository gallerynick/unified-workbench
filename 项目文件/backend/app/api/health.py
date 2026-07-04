"""健康检查端点"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import UnifiedResponse

router = APIRouter(tags=["健康检查"])


@router.get("/health")
async def health_check() -> UnifiedResponse[dict[str, str]]:
    """基础健康检查"""
    return UnifiedResponse(
        data={
            "status": "healthy",
            "version": "1.0.0",
        }
    )


@router.get("/health/db")
async def db_health_check(
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[dict[str, str]]:
    """数据库连接健康检查"""
    try:
        await db.execute(text("SELECT 1"))
        return UnifiedResponse(
            data={
                "status": "healthy",
                "database": "connected",
            }
        )
    except Exception as e:
        return UnifiedResponse(
            code=1,
            msg=f"数据库连接失败: {e!s}",
            data={
                "status": "unhealthy",
                "database": "disconnected",
            }
        )
