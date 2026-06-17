"""导出模块测试（4+ 用例）"""

from __future__ import annotations

import pytest
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


def _weasyprint_available() -> bool:
    try:
        from weasyprint import HTML  # type: ignore[import-untyped]  # noqa: F401
        return True
    except (ImportError, OSError):
        return False


async def _create_template(client, admin_token) -> dict:
    template_payload = {
        "name": "导出测试模板",
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
            {
                "key": "budget",
                "type": "number",
                "label": "预算",
                "required": False,
            },
            {
                "key": "is_active",
                "type": "boolean",
                "label": "是否启用",
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


async def _create_record(client, admin_token, template_id) -> dict:
    payload = {
        "template_id": str(template_id),
        "title": "导出测试记录",
        "data": {
            "project_name": "示例项目",
            "description": "这是描述",
            "budget": 10000,
            "is_active": True,
        },
        "type": "record",
    }
    resp = await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=payload,
    )
    assert resp.status_code == 200
    return resp.json()["data"]


@pytest.mark.asyncio
async def test_export_word(client, admin_token):
    template = await _create_template(client, admin_token)
    record = await _create_record(client, admin_token, template["id"])

    resp = await client.get(
        f"/api/v1/records/{record['id']}/export/word",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert "wordprocessingml" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert len(resp.content) > 0


@pytest.mark.asyncio
async def test_export_pdf(client, admin_token):
    if not _weasyprint_available():
        pytest.skip("WeasyPrint 系统库未安装")

    template = await _create_template(client, admin_token)
    record = await _create_record(client, admin_token, template["id"])

    resp = await client.get(
        f"/api/v1/records/{record['id']}/export/pdf",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert len(resp.content) > 0


@pytest.mark.asyncio
async def test_export_excel(client, admin_token):
    template = await _create_template(client, admin_token)
    record = await _create_record(client, admin_token, template["id"])

    resp = await client.get(
        f"/api/v1/records/{record['id']}/export/excel",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert "spreadsheetml" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert len(resp.content) > 0


@pytest.mark.asyncio
async def test_export_nonexistent(client, admin_token):
    fake_id = "00000000-0000-0000-0000-000000000000"

    resp = await client.get(
        f"/api/v1/records/{fake_id}/export/word",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 404
