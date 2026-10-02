"""第三方服务配置 API 路由"""

from __future__ import annotations

import asyncio

from typing import Any

# 保存配置时触发的后台预热任务引用（防 GC 回收协程）
_WARMUP_SAVE_TASKS: list[asyncio.Task] = []

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
    warmup_ai_model as warmup_ai_service,
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
    data = request.model_dump(exclude_unset=True)
    config = await update_config_service(db, current_user, data)

    # 开启模型自热备后，后台触发一次预热，避免用户以为开关生效但实际没载入。
    # 预热可能耗时（加载权重 / 等引擎就绪），不能 await——否则保存请求
    # 会卡住（前端一直转圈），模型未加载时更甚。
    if config.warmup.ai or config.warmup.asr:
        try:
            import asyncio

            from app.tasks.model_warmup import ensure_models_warm

            _task = asyncio.create_task(ensure_models_warm())
            _WARMUP_SAVE_TASKS.append(_task)  # 保存引用防 GC
        except Exception:
            # 不阻断配置保存；Celery 周期调度会继续兜底
            pass

    return UnifiedResponse(data=config)


@router.post("/ai/test", response_model=UnifiedResponse[TestConnectionResponse])
async def test_ai_connection_endpoint(
    request: dict = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """测试 AI 服务连接，支持测速"""
    # 如果请求中带有配置，使用临时配置测试
    if request and request.get("ai_provider"):
        # 使用请求中的配置测试
        from app.schemas.third_party_config import AIProviderConfig
        ai_config = AIProviderConfig(**request["ai_provider"])
        from app.services.third_party_config import test_ai_with_config
        # 传递测速参数
        measure_speed = request.get("measure_speed", False)
        test_prompt = request.get("test_prompt", "Hi")
        result = await test_ai_with_config(ai_config, measure_speed=measure_speed, test_prompt=test_prompt)
    else:
        result = await test_ai_service(db)
    return UnifiedResponse(data=result)


@router.post("/asr/test", response_model=UnifiedResponse[TestConnectionResponse])
async def test_asr_service_endpoint(
    request: dict = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """测试 ASR 服务"""
    if request and request.get("asr_config"):
        from app.schemas.third_party_config import ASRConfig
        asr_config = ASRConfig(**request["asr_config"])
        from app.services.third_party_config import test_asr_with_config
        result = await test_asr_with_config(asr_config)
    else:
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


@router.post("/asr/delete", response_model=UnifiedResponse[TestConnectionResponse])
async def delete_asr_model_endpoint(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """删除本地 ASR 模型"""
    from app.services.third_party_config import delete_asr_model
    result = await delete_asr_model(db)
    return UnifiedResponse(data=result)


@router.post("/ai/unload", response_model=UnifiedResponse[TestConnectionResponse])
async def unload_ai_model_endpoint(
    request: dict = None,
    current_user: User = Depends(require_admin),
):
    """卸载已加载的 AI 模型，释放内存"""
    from app.services.third_party_config import unload_ai_model
    model_name = request.get("model") if request else None
    result = await unload_ai_model(model_name)
    return UnifiedResponse(data=result)


@router.post("/ai/warmup", response_model=UnifiedResponse[TestConnectionResponse])
async def warmup_ai_model_endpoint(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """按配置预热 AI 模型，仅本地模式有效"""
    result = await warmup_ai_service(db)
    return UnifiedResponse(data=result)


@router.get("/asr/status", response_model=UnifiedResponse[dict[str, Any]])
async def get_asr_model_status(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取本地 ASR 模型状态"""
    from app.services.third_party_config import get_asr_model_status
    result = await get_asr_model_status(db)
    return UnifiedResponse(data=result)


@router.post("/asr/preload", response_model=UnifiedResponse[TestConnectionResponse])
async def preload_asr_models_endpoint(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """预热（必要时下载并加载）本地 ASR 模型，后台执行"""
    from app.services.third_party_config import preload_asr_models
    result = await preload_asr_models(db)
    return UnifiedResponse(data=result)


@router.get("/asr/memory", response_model=UnifiedResponse[dict[str, Any]])
async def get_memory_info_endpoint(
    current_user: User = Depends(require_admin),
):
    """获取系统内存信息和建议"""
    from app.services.third_party_config import get_memory_info
    result = await get_memory_info()
    return UnifiedResponse(data=result)


@router.post("/asr/unload", response_model=UnifiedResponse[TestConnectionResponse])
async def unload_asr_model_endpoint(
    current_user: User = Depends(require_admin),
):
    """卸载已加载的 ASR 模型，释放内存"""
    from app.services.third_party_config import unload_asr_model
    result = await unload_asr_model()
    return UnifiedResponse(data=result)
