"""测试配置与共享 fixtures。"""

import os

# 必须在导入任何 app 模块之前设置，否则 database.py 会在 import 时
# 用 postgresql+asyncpg:// 创建引擎并报 validator 错误。
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test"
)

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
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
    import app.models  # noqa: F401 - 导入整个包，确保全部模型注册到 Base.metadata

    eng = create_async_engine(TEST_DATABASE_URL, echo=False)

    # SQLite 默认不强制外键约束，需按连接开启，否则 note_link 的
    # ON DELETE CASCADE 在测试库不会生效（PostgreSQL 默认强制）
    @event.listens_for(eng.sync_engine, "connect")
    def _enable_foreign_keys(dbapi_conn, _connection_record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    # drop_all 前关闭外键：project_meeting / project_proposal / project_todo
    # 存在循环外键，SQLite 排不出安全删除顺序（生产 PostgreSQL 不受影响）。
    # PRAGMA foreign_keys 在事务内是 no-op，故用独立连接并先提交退出事务。
    async with eng.connect() as conn:
        await conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
        await conn.commit()
        await conn.run_sync(Base.metadata.drop_all)
        await conn.commit()
    await eng.dispose()


@pytest.fixture
async def db(engine):
    """每个测试一个独立连接级事务，测试结束后整体回滚，保证测试隔离。

    使用连接级事务（而非 session.begin()），使接口内部调用的 db.commit()
    不会破坏外层事务——所有改动最终随连接级事务回滚，从而支持多请求、
    含 commit 的测试（如登录后刷新、2FA 绑定流程等）。
    """
    async with engine.connect() as connection:
        trans = await connection.begin()
        session_factory = async_sessionmaker(
            bind=connection, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            yield session
        await trans.rollback()


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


@pytest.fixture(autouse=True)
def _sqlite_naive_clock(monkeypatch):
    """把 app.core.deps 内的 now_shanghai 换成 naive 版本（仅测试环境）。

    背景：UserSession.last_active_at 是 DateTime(timezone=True) +
    server_default=func.now()。PostgreSQL 往返保持 aware，SQLite 不保留时区，
    写回后读回是 naive datetime。get_current_user 中
    `session.last_active_at < now_shanghai() - timedelta(...)` 因此抛
    TypeError，被该函数的兜底 except 转成 401「无效的令牌」——生产
    （PostgreSQL）不受影响，属测试库特有问题。
    让时钟与列取值同为 naive，即可消除该比较。
    """
    import datetime

    import app.core.deps as deps

    monkeypatch.setattr(deps, "now_shanghai", lambda: datetime.datetime.now())


@pytest.fixture(autouse=True)
def _sqlite_jsonb_contains(monkeypatch):
    """用 LIKE 近似替换 JSONB 的 @> 包含判断（仅测试环境）。

    visibility.check_visibility 用 restricted_users.contains([uid]) 表达
    「uid 在 restricted_users 数组内」。该表达式在 PostgreSQL 上编译为 @>，
    SQLite 报 `unrecognized token: "@"`，导致所有走可见性过滤的列表接口
    在测试库上不可用（笔记、密钥等模块均受影响）。

    restricted_users 存的是 UUID 字符串数组，JSON 文本中每个元素都带引号，
    故匹配 '"<uid>"'（而非裸 uid）以排除子串误命中；语义上等价于 Python
    侧的 str(user_id) in item.restricted_users 成员判断。
    生产代码不变，仅测试环境生效。
    """
    import importlib
    import pkgutil

    from sqlalchemy import String, cast, or_

    import app.services as services_pkg
    import app.services.visibility as vis
    from app.core.visibility import Visibility

    def _check(model_cls, user_id):
        uid = str(user_id)
        ru = cast(model_cls.restricted_users, String)
        return or_(
            model_cls.visibility == Visibility.PUBLIC,
            model_cls.owner_id == user_id,
            (model_cls.visibility == Visibility.RESTRICTED) & ru.like(f'%"{uid}"%'),
        )

    orig = vis.check_visibility
    monkeypatch.setattr(vis, "check_visibility", _check)
    # 各服务模块以 `from ... import check_visibility as <别名>` 绑定了该函数，
    # 且别名不统一（build_visibility_filter / visibility_filter 等），
    # 故按「值 is orig」遍历替换，避免硬编码别名导致漏覆盖。
    for mod_info in pkgutil.iter_modules(services_pkg.__path__):
        try:
            mod = importlib.import_module(f"app.services.{mod_info.name}")
        except ImportError:
            continue
        for name, value in list(vars(mod).items()):
            if value is orig:
                monkeypatch.setattr(mod, name, _check)


async def _issue_token(db, user, device_name: str) -> str:
    """为用户签发测试用 access token，并创建匹配的会话行。

    会话制认证（UserSession.jti 校验）要求令牌 jti 必须能在 user_session
    表中查到且未撤销，否则 get_current_user 返回 401。
    配合 _sqlite_naive_clock，last_active_at 的比较不会抛 TypeError。
    """
    import uuid

    from app.core.security import create_access_token
    from app.models.user_session import UserSession

    jti = str(uuid.uuid4())
    db.add(UserSession(user_id=user.id, jti=jti, device_name=device_name))
    await db.flush()
    return create_access_token(str(user.id), user.role.value, jti)


@pytest.fixture
async def admin_token(db, seeded_admin):
    """为 seeded_admin 生成合法 JWT access token。"""
    return await _issue_token(db, seeded_admin, "pytest-admin")


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
async def member_token(db, seeded_user):
    """为 seeded_user 生成合法 JWT access token（普通成员）。"""
    return await _issue_token(db, seeded_user, "pytest-member")
