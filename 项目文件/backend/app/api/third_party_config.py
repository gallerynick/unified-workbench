"""第三方服务配置 API 路由"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.third_party_config import (
    TestConnectionResponse,
    ThirdPartyConfig,
    ThirdPartyConfigUpdate,
)
from app.services.third_party_config import (
    get_third_party_config as get_config_service,
    reload_asr_model as reload_asr_service,
    test_ai_connection as test_ai_service,
    test_asr_service as test_asr_api_service,
    update_third_party_config as update_config_service,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ThirdPartyConfig])
async def get_third_party_config_endpoint(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取第三方服务配置"""
    config = await get_config_service(db)
    return UnifiedResponse(data=config)


@router.put("/", response_model=UnifiedResponse[ThirdPartyConfig])
async def update_third_party_config_endpoint(
    request: ThirdPartyConfigUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新第三方服务配置"""
    config = await update_config_service(
        db, current_user, request.model_dump(exclude_unset=True)
    )
    return UnifiedResponse(data=config)


@router.post("/ai/test", response_model=UnifiedResponse[TestConnectionResponse])
async def test_ai_connection_endpoint(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """测试 AI 服务连接"""
    result = await test_ai_service(db)
    return UnifiedResponse(data=result)


@router.post("/asr/test", response_model=UnifiedResponse[TestConnectionResponse])
async def test_asr_service_endpoint(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """测试 ASR 服务"""
    result = await test_asr_api_service(db)
    return UnifiedResponse(data=result)


@router.post("/asr/reload", response_model=UnifiedResponse[TestConnectionResponse])
async def reload_asr_model_endpoint(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """重载 ASR 模型"""
    result = await reload_asr_service(db)
    return UnifiedResponse(data=result)
