"""数据库连接模块"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """数据库模型基类"""
    pass


# 惰性初始化，避免模块导入时就创建引擎（测试时需要注入 SQLite）
_engine = None
_session_factory = None


def _get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.DATABASE_URL,
            pool_size=10,
            max_overflow=5,
            pool_pre_ping=True,
            echo=settings.DEBUG,
        )
    return _engine


def _get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            class_=AsyncSession,
            bind=_get_engine(),
            expire_on_commit=False,
        )
    return _session_factory


def get_engine():
    """获取数据库引擎（可被测试覆盖）"""
    return _get_engine()


def get_session_factory():
    """获取会话工厂（可被测试覆盖）"""
    return _get_session_factory()


@asynccontextmanager
async def isolated_session() -> AsyncGenerator[AsyncSession, None]:
    """任务专用数据库会话：每次调用独立引擎，自动提交/回滚并在退出时释放。

    供 Celery 任务使用，替代 ``get_session_factory()``。

    背景：模块级引擎 ``_engine`` 是单例，其连接池跨进程常驻。Celery prefork 池下
    ``asyncio.run()`` 每次调用都新建事件循环，而 asyncpg 连接绑定创建它的那个
    循环，跨循环复用会触发
    ``RuntimeError("Task ... got Future ... attached to a different loop")``，
    表现为「每个 fork worker 首次执行成功、第二次失败」，两个 worker 交替执行时
    约一半定时任务静默失败。

    本上下文管理器为每次调用创建独立引擎并在退出时 ``dispose``，天然只绑定当前
    事件循环；不改动全局引擎，FastAPI 请求路径的池化行为不受影响。
    """
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
    factory = async_sessionmaker(
        class_=AsyncSession, bind=engine, expire_on_commit=False
    )
    try:
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
    finally:
        await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话的依赖注入"""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
