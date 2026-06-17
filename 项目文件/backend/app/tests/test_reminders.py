"""提醒模块测试（6 个用例）"""

from __future__ import annotations

import pytest
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    """让 JSONB 在 SQLite 测试环境中回退为 JSON"""
    return "JSON"


@pytest.mark.asyncio
async def test_create_reminder(client, admin_token):
    """创建定时提醒。"""
    response = await client.post(
        "/api/v1/reminders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "测试提醒",
            "content": "这是测试内容",
            "trigger_type": "timed",
            "trigger_time": "2026-12-31T23:59:59Z",
            "target_users": [],
            "channels": ["websocket"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["title"] == "测试提醒"
    assert data["data"]["status"] == "pending"


@pytest.mark.asyncio
async def test_list_reminders(client, admin_token):
    """列出提醒。"""
    # 先创建一个提醒
    await client.post(
        "/api/v1/reminders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"title": "提醒1", "trigger_type": "timed"},
    )

    response = await client.get(
        "/api/v1/reminders",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["total"] >= 1


@pytest.mark.asyncio
async def test_get_reminder(client, admin_token):
    """获取单个提醒。"""
    # 创建
    create_resp = await client.post(
        "/api/v1/reminders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"title": "获取测试", "trigger_type": "timed"},
    )
    reminder_id = create_resp.json()["data"]["id"]

    response = await client.get(
        f"/api/v1/reminders/{reminder_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["title"] == "获取测试"


@pytest.mark.asyncio
async def test_update_reminder(client, admin_token):
    """更新提醒。"""
    create_resp = await client.post(
        "/api/v1/reminders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"title": "更新前", "trigger_type": "timed"},
    )
    reminder_id = create_resp.json()["data"]["id"]

    response = await client.put(
        f"/api/v1/reminders/{reminder_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"title": "更新后"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["title"] == "更新后"


@pytest.mark.asyncio
async def test_delete_reminder(client, admin_token):
    """删除提醒。"""
    create_resp = await client.post(
        "/api/v1/reminders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"title": "删除测试", "trigger_type": "timed"},
    )
    reminder_id = create_resp.json()["data"]["id"]

    response = await client.delete(
        f"/api/v1/reminders/{reminder_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["code"] == 0


@pytest.mark.asyncio
async def test_get_nonexistent_reminder(client, admin_token):
    """获取不存在的提醒返回 404。"""
    response = await client.get(
        "/api/v1/reminders/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 404
