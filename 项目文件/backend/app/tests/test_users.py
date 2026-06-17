"""用户管理模块测试（6 个用例）。"""

import pytest


@pytest.mark.asyncio
async def test_admin_list_users(client, admin_token, seeded_users):
    """管理员分页查询用户列表。"""
    response = await client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["total"] >= 5
    assert len(data["data"]["items"]) >= 5


@pytest.mark.asyncio
async def test_admin_create_user(client, admin_token):
    """管理员创建用户。"""
    response = await client.post(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "newuser",
            "password": "newpass123",
            "nickname": "新用户",
            "role": "member",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["username"] == "newuser"
    assert data["data"]["nickname"] == "新用户"
    assert data["data"]["role"] == "member"


@pytest.mark.asyncio
async def test_admin_update_user(client, admin_token, seeded_user):
    """管理员更新用户信息。"""
    response = await client.put(
        f"/api/v1/users/{seeded_user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"nickname": "更新后的昵称"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["nickname"] == "更新后的昵称"


@pytest.mark.asyncio
async def test_admin_disable_user(client, admin_token, seeded_user):
    """管理员禁用（软删除）用户。"""
    response = await client.delete(
        f"/api/v1/users/{seeded_user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["status"] == "disabled"


@pytest.mark.asyncio
async def test_member_cannot_list_users(client, member_token):
    """普通成员无法访问用户管理接口（403）。"""
    response = await client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_search_users(client, admin_token, seeded_users):
    """管理员按关键词搜索用户。"""
    response = await client.get(
        "/api/v1/users?search=user01",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["total"] >= 1
    assert any(item["username"] == "user01" for item in data["data"]["items"])
