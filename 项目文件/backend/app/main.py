"""一站式工作台 FastAPI 应用入口"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.schemas.common import UnifiedResponse
from app.version import __version__

logger = logging.getLogger(__name__)


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

    # 启动资源采样器：进程内单例 + 内存环形缓冲，1 秒一次。
    # 采样只读 /proc 与 cgroup，失败仅影响监视页数据，不阻止应用启动。
    from app.services.monitor.sampler import get_sampler

    try:
        await get_sampler().start()
    except Exception:
        logger.exception("启动资源采样器失败")

    # 模型侧自启动预热：仅在本地模式且配置开启时执行，资源不足则跳过。
    from app.services.third_party_config import auto_start_ai_warmup

    factory = get_session_factory()
    async with factory() as db:
        try:
            warmup_result = await auto_start_ai_warmup(db)
            if warmup_result.success:
                logger.info("启动后 AI 模型预热完成")
            else:
                logger.info("启动后 AI 模型预热跳过：%s", warmup_result.message)
        except Exception:
            logger.exception("启动后 AI 模型预热失败")

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
