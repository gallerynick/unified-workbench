"""审计日志模块测试（4 个用例）。"""

import pytest
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


# 让 SQLite 测试环境能渲染 JSONB 列为 JSON
@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(element, compiler, **kw):
    return "JSON"


# 导入 AuditLog 确保模型注册到 Base.metadata（conftest engine fixture 的 create_all 需要）
from app.services.audit import log_audit  # noqa: E402


@pytest.mark.asyncio
async def test_log_audit_creates_record(db, seeded_admin):
    """log_audit() 能正确写入数据库。"""
    audit = await log_audit(
        db=db,
        user_id=seeded_admin.id,
        action="upload_file",
        target_type="file",
        target_id="abc-123",
        detail={"filename": "test.pdf"},
        ip="127.0.0.1",
    )
    assert audit.id is not None
    assert audit.user_id == seeded_admin.id
    assert audit.action == "upload_file"
    assert audit.target_type == "file"
    assert audit.target_id == "abc-123"
    assert audit.detail == {"filename": "test.pdf"}
    assert audit.ip == "127.0.0.1"


@pytest.mark.asyncio
async def test_admin_sees_all_logs(client, db, seeded_admin, admin_token, seeded_user):
    """管理员 GET /audit-logs 能看到所有用户的日志。"""
    # 为 admin 和 member 各创建一条日志
    await log_audit(
        db=db, user_id=seeded_admin.id,
        action="login", target_type="session", target_id="s1",
    )
    await log_audit(
        db=db, user_id=seeded_user.id,
        action="upload_file", target_type="file", target_id="f1",
    )

    response = await client.get(
        "/api/v1/audit-logs/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["total"] == 2
    assert len(data["data"]["items"]) == 2


@pytest.mark.asyncio
async def test_member_sees_own_logs(client, db, seeded_admin, seeded_user, member_token):
    """普通成员 GET /audit-logs 只能看到自己的日志。"""
    # 为 admin 和 member 各创建一条日志
    await log_audit(
        db=db, user_id=seeded_admin.id,
        action="login", target_type="session", target_id="s1",
    )
    await log_audit(
        db=db, user_id=seeded_user.id,
        action="upload_file", target_type="file", target_id="f1",
    )

    response = await client.get(
        "/api/v1/audit-logs/",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["total"] == 1
    assert len(data["data"]["items"]) == 1
    assert data["data"]["items"][0]["action"] == "upload_file"


@pytest.mark.asyncio
async def test_audit_log_pagination(client, db, seeded_admin, admin_token):
    """分页参数 page / page_size 正常工作。"""
    # 创建 5 条日志
    for i in range(5):
        await log_audit(
            db=db,
            user_id=seeded_admin.id,
            action=f"action_{i}",
            target_type="test",
            target_id=f"t{i}",
        )

    # 第一页 2 条
    response = await client.get(
        "/api/v1/audit-logs/?page=1&page_size=2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    data = response.json()
    assert data["data"]["total"] == 5
    assert len(data["data"]["items"]) == 2

    # 第三页 2 条（最后一页只有 1 条）
    response = await client.get(
        "/api/v1/audit-logs/?page=3&page_size=2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    data = response.json()
    assert data["data"]["total"] == 5
    assert len(data["data"]["items"]) == 1
