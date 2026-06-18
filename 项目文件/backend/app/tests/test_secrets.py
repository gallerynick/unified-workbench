"""密钥管理模块测试（7 个用例）"""

import pytest

from app.core.config import get_settings

VALID_HEX_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


@pytest.fixture(autouse=True)
def _patch_encryption_key():
    settings = get_settings()
    original = settings.ENCRYPTION_MASTER_KEY
    settings.ENCRYPTION_MASTER_KEY = VALID_HEX_KEY
    yield
    settings.ENCRYPTION_MASTER_KEY = original


@pytest.mark.asyncio
async def test_create_secret(client, admin_token):
    response = await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "测试API密钥",
            "secret_type": "api_key",
            "data": {"api_key": "sk-abc123", "endpoint": "https://api.example.com"},
            "note": "测试备注",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["name"] == "测试API密钥"
    assert data["data"]["secret_type"] == "api_key"
    assert data["data"]["note"] == "测试备注"
    assert "encrypted_data" not in data["data"]


@pytest.mark.asyncio
async def test_list_secrets(client, admin_token):
    await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "密钥一", "data": {"key": "value1"}},
    )
    await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "密钥二", "data": {"key": "value2"}},
    )

    response = await client.get(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["total"] == 2
    assert len(data["data"]["items"]) == 2


@pytest.mark.asyncio
async def test_list_secrets_search(client, admin_token):
    await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "GitHub密钥", "data": {"token": "ghp_xxx"}},
    )
    await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "数据库配置", "data": {"host": "localhost"}},
    )

    response = await client.get(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"search": "GitHub"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["total"] == 1
    assert data["data"]["items"][0]["name"] == "GitHub密钥"


@pytest.mark.asyncio
async def test_get_secret(client, admin_token):
    create_resp = await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "获取测试", "data": {"secret": "data"}},
    )
    secret_id = create_resp.json()["data"]["id"]

    response = await client.get(
        f"/api/v1/secrets/{secret_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["name"] == "获取测试"
    assert "encrypted_data" not in data["data"]


@pytest.mark.asyncio
async def test_verify_correct_password(client, admin_token):
    create_resp = await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "验证测试",
            "data": {"api_key": "sk-secret-value", "region": "us-east-1"},
        },
    )
    secret_id = create_resp.json()["data"]["id"]

    response = await client.post(
        f"/api/v1/secrets/{secret_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["data"]["api_key"] == "sk-secret-value"
    assert data["data"]["data"]["region"] == "us-east-1"


@pytest.mark.asyncio
async def test_verify_wrong_password(client, admin_token):
    create_resp = await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "错误密码测试", "data": {"key": "val"}},
    )
    secret_id = create_resp.json()["data"]["id"]

    response = await client.post(
        f"/api/v1/secrets/{secret_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"password": "wrongpassword"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_secret(client, admin_token):
    create_resp = await client.post(
        "/api/v1/secrets/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "待删除", "data": {"tmp": "data"}},
    )
    secret_id = create_resp.json()["data"]["id"]

    response = await client.delete(
        f"/api/v1/secrets/{secret_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["code"] == 0

    get_resp = await client.get(
        f"/api/v1/secrets/{secret_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert get_resp.status_code == 404
