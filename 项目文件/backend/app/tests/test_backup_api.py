"""备份 API 测试"""

from unittest.mock import patch

import pytest


@pytest.mark.asyncio
async def test_admin_can_list_backups(client, admin_token):
    """管理员可以列出备份。"""
    with patch("app.services.backup.list_backups", return_value=[]):
        response = await client.get(
            "/api/v1/backups",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json()["code"] == 0


@pytest.mark.asyncio
async def test_member_cannot_list_backups(client, member_token):
    """普通成员无法列出备份。"""
    response = await client.get(
        "/api/v1/backups",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 403
