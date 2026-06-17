"""测试配置与共享 fixtures。"""

import os

# 必须在导入任何 app 模块之前设置，否则 database.py 会在 import 时
# 用 postgresql+asyncpg:// 创建引擎并报 validator 错误。
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.core.database import Base, get_db

# 确保 settings 已缓存（后续 database.py 调用 get_settings() 会命中缓存）
get_settings()

TEST_DATABASE_URL = "sqlite+aiosqlite://"


@pytest.fixture
async def engine():
    """创建测试数据库引擎，建表前建后自动清理。"""
    from app.models import Tag, User, UserTag  # noqa: F401 - 确保模型注册到 Base.metadata

    eng = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest.fixture
async def db(engine):
    """每个测试一个独立事务，测试结束后回滚，保证测试隔离。"""
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        async with session.begin():
            yield session
        # session.begin() 上下文退出时自动 rollback


@pytest.fixture
async def client(db):
    """异步测试客户端，注入测试数据库会话。"""
    from app.main import app as fastapi_app

    async def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
async def seeded_admin(db):
    """预置一个管理员用户，flush 到当前事务中（不 commit）。"""
    from app.core.security import hash_password
    from app.models.user import User, UserRole, UserStatus

    admin = User(
        username="admin",
        password_hash=hash_password("admin123"),
        nickname="管理员",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(admin)
    await db.flush()
    return admin


@pytest.fixture
async def admin_token(seeded_admin):
    """为 seeded_admin 生成合法 JWT access token。"""
    from app.core.security import create_access_token

    return create_access_token(str(seeded_admin.id), seeded_admin.role.value)


@pytest.fixture
async def seeded_user(db):
    """预置一个普通成员用户。"""
    from app.core.security import hash_password
    from app.models.user import User, UserRole, UserStatus

    user = User(
        username="member01",
        password_hash=hash_password("member123"),
        nickname="成员一",
        role=UserRole.MEMBER,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    await db.flush()
    return user


@pytest.fixture
async def seeded_users(db):
    """预置多个用户用于列表/搜索测试。"""
    from app.core.security import hash_password
    from app.models.user import User, UserRole, UserStatus

    users = []
    for i in range(5):
        u = User(
            username=f"user{i:02d}",
            password_hash=hash_password(f"pass{i:02d}abc"),
            nickname=f"测试用户{i}",
            role=UserRole.MEMBER,
            status=UserStatus.ACTIVE,
        )
        db.add(u)
        users.append(u)
    await db.flush()
    return users


@pytest.fixture
async def member_token(seeded_user):
    """为 seeded_user 生成合法 JWT access token（普通成员）。"""
    from app.core.security import create_access_token

    return create_access_token(str(seeded_user.id), seeded_user.role.value)
