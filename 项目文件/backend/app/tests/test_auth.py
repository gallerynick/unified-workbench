"""认证模块测试（8 个用例）。"""

import pytest


@pytest.mark.asyncio
async def test_login_success(client, seeded_admin):
    """登录成功：返回 access_token + refresh_token。"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]


@pytest.mark.asyncio
async def test_login_wrong_password(client, seeded_admin):
    """错误密码：返回 401。"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    """不存在的用户：返回 401。"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "nonexistent", "password": "admin123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_disabled_user(client, db):
    """已禁用用户：返回 401。"""
    from app.core.security import hash_password
    from app.models.user import User, UserRole, UserStatus

    user = User(
        username="disabled",
        password_hash=hash_password("admin123"),
        nickname="Disabled",
        role=UserRole.MEMBER,
        status=UserStatus.DISABLED,
    )
    db.add(user)
    await db.flush()

    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "disabled", "password": "admin123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_success(client, seeded_admin):
    """刷新令牌成功：用 refresh_token 换取新 access_token。"""
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    tokens = login_response.json()["data"]

    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert "access_token" in data["data"]


@pytest.mark.asyncio
async def test_get_me_success(client, admin_token):
    """获取当前用户信息成功。"""
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["username"] == "admin"


@pytest.mark.asyncio
async def test_get_me_no_token(client):
    """无令牌访问 /me：返回 401。"""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_change_password_success(client, admin_token):
    """修改密码成功：旧密码验证通过，新密码可正常登录。"""
    response = await client.put(
        "/api/v1/auth/me/password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"old_password": "admin123", "new_password": "newpass123"},
    )
    assert response.status_code == 200

    # 用新密码登录验证
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "newpass123"},
    )
    assert login_response.status_code == 200
