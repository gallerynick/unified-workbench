"""一站式工作台 FastAPI 应用入口"""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

# 启动时创建的后台预热任务引用（防止 GC 回收协程）
_STARTUP_WARMUP_TASK: list[asyncio.Task] = []

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.schemas.common import UnifiedResponse
from app.version import __version__

logger = logging.getLogger(__name__)


async def _asr_warmup_loop() -> None:
    """backend 进程内 ASR 自热备：每 10s 检查并保持载入。

    Celery 的 ensure_models_warm 维护的是 celery 进程内的 SenseVoice；
    backend 进程（WS 实时转写 / 状态查询）必须自己维持——
    手动卸载后下一个周期自动补载，实现「自热备」语义。
    """
    from app.core.database import get_session_factory
    from app.services import asr_engine
    from app.services.third_party_config import (
        get_third_party_config,
        preload_asr_models,
    )

    factory = get_session_factory()
    while True:
        try:
            async with factory() as db:
                config = await get_third_party_config(db)
                if (
                    config.warmup.asr
                    and config.asr_config.mode == "local"
                    and not asr_engine.is_available()
                ):
                    await preload_asr_models(db)
        except Exception:
            pass
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """应用生命周期管理"""
    from app.core.database import get_session_factory
    from app.services.system_config import get_config
    from app.utils.seed import create_initial_admin

    factory = get_session_factory()
    async with factory() as db:
        await create_initial_admin(db)
        # 从站点自定义配置读取应用名称，动态设置 Swagger/OpenAPI 标题
        cfg = await get_config(db, "custom_config") or {}
        app_name = cfg.get("app_name")
        if app_name:
            app.title = app_name

    # 清理上一进程遗留的下载任务：下载由 asyncio.create_task 驱动，
    # 进程重启后协程消失但 Redis 状态仍是 downloading，会变成永久卡住的僵尸任务
    from app.services.model_download import reap_orphaned_downloads

    try:
        reaped = await reap_orphaned_downloads()
        if reaped:
            logger.info("启动清理孤儿下载任务 %d 个", reaped)
    except Exception:
        logger.exception("启动清理孤儿下载任务失败")

    # 兜底：上一进程遗留「processing」的会议重新入队会后处理。
    # 会议结束后 Celery 任务若在进程重启/瞬时故障中丢失，会议会永远卡在
    # processing（转录与纪要都不生成）。这里把它们重新入队，幂等无害。
    try:
        from sqlalchemy import select

        from app.models.meeting_record import MeetingRecord
        from app.tasks.meeting_process import process_meeting

        async with factory() as db:
            stuck = (
                await db.execute(
                    select(MeetingRecord).where(
                        MeetingRecord.status == "processing"
                    )
                )
            ).scalars().all()
            for m in stuck:
                process_meeting.delay(str(m.id))
                logger.info("重新入队遗留会议会后处理：%s", m.id)
            if stuck:
                logger.info("启动恢复 %d 个卡住的会议", len(stuck))
    except Exception:
        logger.exception("启动恢复卡住会议失败")

    # 启动资源采样器：进程内单例 + 内存环形缓冲，1 秒一次。
    # 采样只读 /proc 与 cgroup，失败仅影响监视页数据，不阻止应用启动。
    from app.services.monitor.sampler import get_sampler

    try:
        await get_sampler().start()
    except Exception:
        logger.exception("启动资源采样器失败")

    # 模型自热备：后台循环，不阻塞应用启动。
    # 预热可能耗时（加载权重 / 等待引擎就绪），若在 lifespan 里 await，
    # uvicorn 要等它完成才对外服务，健康检查会一直失败。
    # 注意：Celery 的 ensure_models_warm 只维护 celery 进程的 ASR；
    # 本进程（backend）的 WS 实时转写与状态查询用本进程内的 SenseVoice，
    # 必须由本进程自行循环维护——否则手动卸载后永不自动恢复。
    try:
        _warmup_task = asyncio.create_task(_asr_warmup_loop())
        # 保存引用防止 GC 提前回收后台协程
        _STARTUP_WARMUP_TASK.append(_warmup_task)
    except Exception:
        logger.exception("启动后台模型预热任务失败")

    yield

    try:
        await get_sampler().stop()
    except Exception:
        logger.exception("停止资源采样器失败")


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """未捕获异常统一返回 JSON。

    FastAPI 默认对未捕获异常返回纯文本 ``Internal Server Error``，前端
    ``request()`` 解析 JSON 失败后只能退化成笼统的 ``Request failed``，用户
    无从得知失败原因。这里统一走 {code, msg, data} 契约，前端会取
    ``error.msg`` 展示给调用方。

    HTTPException（4xx 业务错误）与 RequestValidationError（422）由 FastAPI
    自带的处理器优先处理，不受本函数影响。
    """
    settings = get_settings()
    detail = f"{type(exc).__name__}: {exc}" if settings.DEBUG else "服务器内部错误"
    logger.exception(
        "未处理的请求异常 method=%s path=%s", request.method, request.url.path
    )
    return JSONResponse(
        status_code=500, content=UnifiedResponse(code=500, msg=detail).model_dump()
    )


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用"""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        # redirect_slashes=False removed — FastAPI default handles /path ↔ /path/
        version=__version__,
        docs_url="/api/v1/docs",
        openapi_url="/api/v1/openapi.json",
        lifespan=lifespan,
    )

    # CORS 配置
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 未捕获异常统一返回 JSON（见 unhandled_exception_handler）
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # 注册路由
    from app.api.router import api_router
    from app.api.ws import router as ws_router
    from app.api.meeting_ws import router as meeting_ws_router

    app.include_router(api_router, prefix="/api/v1")
    app.include_router(ws_router)
    app.include_router(meeting_ws_router)

    return app


app = create_app()
