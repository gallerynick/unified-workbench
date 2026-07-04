"""一站式工作台 FastAPI 应用入口"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.version import __version__


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """应用生命周期管理"""
    from app.core.database import get_session_factory
    from app.utils.seed import create_initial_admin

    factory = get_session_factory()
    async with factory() as db:
        await create_initial_admin(db)

    yield


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
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    from app.api.router import api_router
    from app.api.ws import router as ws_router

    app.include_router(api_router, prefix="/api/v1")
    app.include_router(ws_router)

    return app


app = create_app()
