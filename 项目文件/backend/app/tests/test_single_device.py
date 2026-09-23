"""单设备登录策略（允许多处同时登录开关）测试 — service 层。

直接测试 services.auth._enforce_single_device 的计数/下线语义：
- 返回值第一项只统计 device_token 不同的「其他设备」会话；
- 第二项是本次实际下线的会话总数（含同一浏览器遗留的旧会话）。

说明：不使用 client fixture（其会导入 app.main → api/webauthn → webauthn 库，
当前测试环境无法安装该依赖），改为直接调用 service 函数验证核心逻辑。
"""

import pytest

from app.services.auth import _enforce_single_device


def _make_session(db, user, jti: str, device_token: str | None):
    from app.models.user_session import UserSession

    s = UserSession(
        user_id=user.id,
        jti=jti,
        device_name="测试设备",
        device_type="desktop",
        device_token=device_token,
    )
    db.add(s)
    return s


async def _active_sessions(db, user):
    from sqlalchemy import select

    from app.models.user_session import UserSession

    result = await db.execute(
        select(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.is_revoked.is_(False),
        )
    )
    return list(result.scalars().all())


@pytest.mark.asyncio
async def test_same_device_not_counted_as_other(db, seeded_user):
    """单设备 + 同一浏览器（同 device_token）重新登录：
    旧会话被下线，但不计入「其他设备」。"""
    _make_session(db, seeded_user, "old-jti", "dev-same")
    await db.flush()

    other, revoked = await _enforce_single_device(
        db, seeded_user, allow_multiple_logins=False, device_token="dev-same"
    )
    assert other == 0
    assert revoked == 1
    assert await _active_sessions(db, seeded_user) == []


@pytest.mark.asyncio
async def test_other_device_counted_and_revoked(db, seeded_user):
    """单设备 + 其他设备：计入并下线。"""
    _make_session(db, seeded_user, "old-jti", "dev-other")
    await db.flush()

    other, revoked = await _enforce_single_device(
        db, seeded_user, allow_multiple_logins=False, device_token="dev-new"
    )
    assert other == 1
    assert revoked == 1
    assert await _active_sessions(db, seeded_user) == []


@pytest.mark.asyncio
async def test_multiple_allowed_counts_but_not_revoked(db, seeded_user):
    """允许多处：统计其他设备但不下线。"""
    _make_session(db, seeded_user, "old-jti", "dev-other")
    await db.flush()

    other, revoked = await _enforce_single_device(
        db, seeded_user, allow_multiple_logins=True, device_token="dev-new"
    )
    assert other == 1
    assert revoked == 0
    assert len(await _active_sessions(db, seeded_user)) == 1


@pytest.mark.asyncio
async def test_legacy_session_without_device_token_counts_as_other(db, seeded_user):
    """历史会话无 device_token：计入其他设备（防漏报）。"""
    _make_session(db, seeded_user, "legacy-jti", None)
    await db.flush()

    other, revoked = await _enforce_single_device(
        db, seeded_user, allow_multiple_logins=False, device_token="dev-new"
    )
    assert other == 1
    assert revoked == 1


@pytest.mark.asyncio
async def test_mixed_sessions_counting(db, seeded_user):
    """混合场景：同浏览器旧会话 + 其他设备会话并存。"""
    _make_session(db, seeded_user, "same-jti", "dev-same")
    _make_session(db, seeded_user, "other-jti", "dev-phone")
    await db.flush()

    other, revoked = await _enforce_single_device(
        db, seeded_user, allow_multiple_logins=False, device_token="dev-same"
    )
    assert other == 1  # 只统计 dev-phone
    assert revoked == 2  # 全部下线
    assert await _active_sessions(db, seeded_user) == []
