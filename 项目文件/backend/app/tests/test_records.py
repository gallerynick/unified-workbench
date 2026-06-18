"""记录模块测试（7+ 用例）"""

from __future__ import annotations

import pytest
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


async def _create_template(client, admin_token) -> dict:
    """创建测试模板并返回模板数据。"""
    template_payload = {
        "name": "测试模板",
        "category": "测试",
        "schema": [
            {
                "key": "project_name",
                "type": "text",
                "label": "项目名称",
                "required": True,
            },
            {
                "key": "description",
                "type": "textarea",
                "label": "描述",
                "required": False,
            },
        ],
    }
    resp = await client.post(
        "/api/v1/templates",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=template_payload,
    )
    return resp.json()["data"]


async def _create_record(client, admin_token, template_id, **overrides) -> dict:
    """创建测试记录并返回记录数据。"""
    payload = {
        "template_id": str(template_id),
        "title": "测试记录",
        "data": {"project_name": "示例项目"},
        "type": "record",
        **overrides,
    }
    resp = await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=payload,
    )
    assert resp.status_code == 200
    return resp.json()["data"]


@pytest.mark.asyncio
async def test_create_record(client, admin_token):
    """创建记录，验证 template_snapshot 已捕获模板 schema。"""
    template = await _create_template(client, admin_token)
    record = await _create_record(client, admin_token, template["id"])

    assert record["title"] == "测试记录"
    assert record["template_id"] == template["id"]
    assert record["status"] == "draft"
    assert record["type"] == "record"
    assert record["data"] == {"project_name": "示例项目"}

    # template_snapshot 必须等于模板的 schema
    snapshot = record["template_snapshot"]
    assert isinstance(snapshot, list)
    assert len(snapshot) == 2
    assert snapshot[0]["key"] == "project_name"
    assert snapshot[1]["key"] == "description"


@pytest.mark.asyncio
async def test_list_records(client, admin_token):
    """创建 2 条记录，列表返回两条。"""
    template = await _create_template(client, admin_token)
    await _create_record(client, admin_token, template["id"], title="记录一")
    await _create_record(client, admin_token, template["id"], title="记录二")

    resp = await client.get(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_list_records_by_type(client, admin_token):
    """按 type 筛选记录。"""
    template = await _create_template(client, admin_token)
    await _create_record(client, admin_token, template["id"], type="project")
    await _create_record(client, admin_token, template["id"], type="record")

    resp = await client.get(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"type": "project"},
    )
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["type"] == "project"


@pytest.mark.asyncio
async def test_update_record(client, admin_token):
    """更新记录的 title 和 data。"""
    template = await _create_template(client, admin_token)
    record = await _create_record(client, admin_token, template["id"])

    resp = await client.put(
        f"/api/v1/records/{record['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"title": "新标题", "data": {"project_name": "更新后的项目"}},
    )
    assert resp.status_code == 200
    updated = resp.json()["data"]
    assert updated["title"] == "新标题"
    assert updated["data"] == {"project_name": "更新后的项目"}


@pytest.mark.asyncio
async def test_update_record_status(client, admin_token):
    """状态流转：draft → ongoing → done → archived。"""
    template = await _create_template(client, admin_token)
    record = await _create_record(client, admin_token, template["id"])
    record_id = record["id"]

    # draft → ongoing
    resp = await client.put(
        f"/api/v1/records/{record_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "ongoing"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ongoing"

    # ongoing → done
    resp = await client.put(
        f"/api/v1/records/{record_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "done"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "done"

    # done → archived
    resp = await client.put(
        f"/api/v1/records/{record_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "archived"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "archived"


@pytest.mark.asyncio
async def test_invalid_status_transition(client, admin_token):
    """非法状态流转：draft → done 应失败。"""
    template = await _create_template(client, admin_token)
    record = await _create_record(client, admin_token, template["id"])

    resp = await client.put(
        f"/api/v1/records/{record['id']}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "done"},
    )
    assert resp.status_code == 400
    assert "不合法" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_delete_record(client, admin_token):
    """删除记录后应从数据库移除。"""
    template = await _create_template(client, admin_token)
    record = await _create_record(client, admin_token, template["id"])
    record_id = record["id"]

    # 删除
    resp = await client.delete(
        f"/api/v1/records/{record_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200

    # 再次获取应 404
    resp = await client.get(
        f"/api/v1/records/{record_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 404
