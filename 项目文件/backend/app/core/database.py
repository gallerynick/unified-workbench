"""数据库连接模块"""

from collections.abc import AsyncGenerator

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
            pool_size=20,
            max_overflow=10,
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
