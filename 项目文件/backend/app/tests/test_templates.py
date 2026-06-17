"""模板管理模块测试（6 个用例）"""

from __future__ import annotations

import pytest
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


def _sample_schema() -> list[dict]:
    """返回一组示例字段定义"""
    return [
        {
            "key": "title",
            "type": "text",
            "label": "标题",
            "required": True,
            "sort_order": 0,
        },
        {
            "key": "content",
            "type": "richtext",
            "label": "正文",
            "required": False,
            "sort_order": 1,
        },
    ]


@pytest.mark.asyncio
async def test_create_template(client, admin_token):
    """创建模板并验证字段"""
    payload = {
        "name": "项目报告模板",
        "category": "报告",
        "schema": _sample_schema(),
    }
    response = await client.post(
        "/api/v1/templates",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["name"] == "项目报告模板"
    assert data["data"]["category"] == "报告"
    assert len(data["data"]["schema"]) == 2
    assert data["data"]["schema"][0]["key"] == "title"
    assert data["data"]["version"] == 1


@pytest.mark.asyncio
async def test_list_templates(client, admin_token):
    """创建 2 个模板，列表返回两个"""
    for name in ["模板A", "模板B"]:
        await client.post(
            "/api/v1/templates",
            json={"name": name, "schema": _sample_schema()},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

    response = await client.get(
        "/api/v1/templates",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["total"] == 2
    assert len(data["data"]["items"]) == 2


@pytest.mark.asyncio
async def test_list_templates_by_category(client, admin_token):
    """按分类过滤模板"""
    await client.post(
        "/api/v1/templates",
        json={"name": "报告模板", "category": "报告", "schema": _sample_schema()},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    await client.post(
        "/api/v1/templates",
        json={"name": "会议模板", "category": "会议", "schema": _sample_schema()},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    response = await client.get(
        "/api/v1/templates",
        params={"category": "报告"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["total"] == 1
    assert data["data"]["items"][0]["category"] == "报告"


@pytest.mark.asyncio
async def test_update_template_version(client, admin_token):
    """更新模板 schema 时版本号递增"""
    create_resp = await client.post(
        "/api/v1/templates",
        json={"name": "版本测试", "schema": _sample_schema()},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    template_id = create_resp.json()["data"]["id"]
    assert create_resp.json()["data"]["version"] == 1

    new_schema = _sample_schema() + [
        {
            "key": "priority",
            "type": "select",
            "label": "优先级",
            "required": False,
            "sort_order": 2,
            "options": [{"label": "高", "value": "high"}],
        }
    ]
    update_resp = await client.put(
        f"/api/v1/templates/{template_id}",
        json={"schema": new_schema},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["data"]["version"] == 2
    assert len(data["data"]["schema"]) == 3


@pytest.mark.asyncio
async def test_delete_template(client, admin_token):
    """删除模板后从数据库移除"""
    create_resp = await client.post(
        "/api/v1/templates",
        json={"name": "待删除", "schema": _sample_schema()},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    template_id = create_resp.json()["data"]["id"]

    delete_resp = await client.delete(
        f"/api/v1/templates/{template_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_resp.status_code == 200
    assert delete_resp.json()["code"] == 0

    # 再次获取应 404
    get_resp = await client.get(
        f"/api/v1/templates/{template_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_export_import_template(client, admin_token):
    """导出模板 JSON 后导入，验证一致性"""
    create_resp = await client.post(
        "/api/v1/templates",
        json={"name": "导出测试", "category": "测试", "schema": _sample_schema()},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    template_id = create_resp.json()["data"]["id"]

    # 导出
    export_resp = await client.get(
        f"/api/v1/templates/{template_id}/export",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert export_resp.status_code == 200
    exported = export_resp.json()["data"]
    assert exported["name"] == "导出测试"
    assert exported["category"] == "测试"
    assert len(exported["schema"]) == 2

    # 导入
    import_resp = await client.post(
        "/api/v1/templates/import",
        json=exported,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert import_resp.status_code == 200
    imported = import_resp.json()["data"]
    assert imported["name"] == exported["name"]
    assert imported["category"] == exported["category"]
    assert imported["schema"] == exported["schema"]
    assert imported["id"] != template_id  # 新的 ID
