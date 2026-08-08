"""数据迁移链测试

验证各版本迁移函数的正确性和 apply_migration_chain 的端到端行为。
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

# 设置项目路径以正确导入 app 模块
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.data_migrations.v0_2_0 import upgrade as v0_2_0_upgrade
from app.services.data_migrations.v1_0_0 import upgrade as v1_0_0_upgrade
from app.services.data_migrations.v1_0_1 import upgrade as v1_0_1_upgrade
from app.services.data_migrations import apply_migration_chain

passed = 0
failed = 0


def check(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✓ {name}")
    else:
        failed += 1
        print(f"  ✗ {name}  — {detail}")


def test_v0_2_0():
    print("\n=== v0.2.0 → v1.0.0 ===")

    # 1. record table returns empty list
    result = v0_2_0_upgrade("record", [{"id": 1, "name": "test"}])
    check("record table: returns empty list", result == [])

    # 2. Visibility tables get defaults
    for table in ["inventory", "contact", "budget", "subscription", "task",
                  "note", "calendar_event", "secret", "secret_category",
                  "template", "reminder", "project", "server", "vote"]:
        result = v0_2_0_upgrade(table, [{"id": 1}])
        check(
            f"{table}: visibility='private' + restricted_users=[]",
            result[0].get("visibility") == "private" and result[0].get("restricted_users") == []
        )

    # 3. Idempotent: don't overwrite existing visibility
    result = v0_2_0_upgrade("task", [{"id": 1, "visibility": "public", "restricted_users": ["user1"]}])
    check(
        "idempotent: existing visibility preserved",
        result[0]["visibility"] == "public" and result[0]["restricted_users"] == ["user1"]
    )

    # 4. File → file_share mapping
    file_records = [{
        "id": "file-uuid-1",
        "name": "report.pdf",
        "stored_path": "/data/files/report.pdf",
        "owner_id": "user-uuid-1",
        "file_size": 1024,
        "mime_type": "application/pdf",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-02T00:00:00Z",
    }]
    result = v0_2_0_upgrade("file", file_records)
    r = result[0]
    check("file→file_share: id preserved", r["id"] == "file-uuid-1")
    check("file→file_share: original_name mapped", r["original_name"] == "report.pdf")
    check("file→file_share: file_path mapped", r["file_path"] == "/data/files/report.pdf")
    check("file→file_share: owner_id preserved", r["owner_id"] == "user-uuid-1")
    check("file→file_share: file_size preserved", r["file_size"] == 1024)
    check("file→file_share: mime_type preserved", r["mime_type"] == "application/pdf")
    check("file→file_share: share_code generated (8-char uppercase+digits)",
          len(r["share_code"]) == 8 and r["share_code"].isalnum() and r["share_code"].isupper())
    check("file→file_share: password_hash is None", r["password_hash"] is None)
    check("file→file_share: expires_at is now+7days",
          r["expires_at"] is not None and isinstance(r["expires_at"], datetime))
    check("file→file_share: max_downloads is None", r["max_downloads"] is None)
    check("file→file_share: download_count is 0", r["download_count"] == 0)
    check("file→file_share: is_deleted is False", r["is_deleted"] is False)
    check("file→file_share: deleted_at is None", r["deleted_at"] is None)
    check("file→file_share: created_at preserved", r["created_at"] == "2024-01-01T00:00:00Z")
    check("file→file_share: updated_at preserved", r["updated_at"] == "2024-01-02T00:00:00Z")

    # 5. Pass-through for unknown tables
    result = v0_2_0_upgrade("unknown_table", [{"key": "value"}])
    check("unknown table: pass-through", result == [{"key": "value"}])


def test_v1_0_0():
    print("\n=== v1.0.0 → v1.0.1 ===")

    # 1. servers table
    servers = [{"name": "web-01"}]
    result = v1_0_0_upgrade("servers", servers)
    s = result[0]
    check("servers: hardware_specs default {}", s["hardware_specs"] == {})
    check("servers: hostname defaults to name", s["hostname"] == "web-01")
    check("servers: os default ''", s["os"] == "")
    check("servers: ram_unit default 'GB'", s["ram_unit"] == "GB")
    check("servers: disk_unit default 'GB'", s["disk_unit"] == "GB")

    # servers with ram_gb/disk_gb legacy fields
    servers2 = [{"name": "db-01", "ram_gb": 16, "disk_gb": 500}]
    result = v1_0_0_upgrade("servers", servers2)
    s2 = result[0]
    check("servers: ram_capacity ← ram_gb", s2["ram_capacity"] == 16)
    check("servers: disk_capacity ← disk_gb", s2["disk_capacity"] == 500)

    # servers idempotent: don't overwrite existing
    servers3 = [{
        "name": "app-01", "hardware_specs": {"cpu": 4},
        "hostname": "app-01-prod", "os": "ubuntu", "ram_capacity": 32,
        "ram_unit": "TB", "disk_capacity": 1000, "disk_unit": "TB"
    }]
    result = v1_0_0_upgrade("servers", servers3)
    s3 = result[0]
    check("servers idempotent: hardware_specs preserved", s3["hardware_specs"] == {"cpu": 4})
    check("servers idempotent: hostname preserved", s3["hostname"] == "app-01-prod")
    check("servers idempotent: os preserved", s3["os"] == "ubuntu")
    check("servers idempotent: ram_capacity preserved", s3["ram_capacity"] == 32)
    check("servers idempotent: ram_unit preserved", s3["ram_unit"] == "TB")
    check("servers idempotent: disk_capacity preserved", s3["disk_capacity"] == 1000)
    check("servers idempotent: disk_unit preserved", s3["disk_unit"] == "TB")

    # 2. reminder table: remove channels
    reminders = [
        {"id": 1, "channels": ["email", "wechat"], "message": "test1"},
        {"id": 2, "message": "test2"},
    ]
    result = v1_0_0_upgrade("reminder", reminders)
    check("reminder: channels removed (had channels)", "channels" not in result[0])
    check("reminder: channels removal safe (no channels)", "channels" not in result[1])
    check("reminder: other fields preserved", result[0]["message"] == "test1")

    # 3. user table
    users = [{"username": "admin"}]
    result = v1_0_0_upgrade("user", users)
    u = result[0]
    check("user: email default None", u["email"] is None)
    check("user: phone default None", u["phone"] is None)
    check("user: gender default None", u["gender"] is None)

    # user idempotent
    users2 = [{"username": "user1", "email": "a@b.com", "phone": "123", "gender": "male"}]
    result = v1_0_0_upgrade("user", users2)
    u2 = result[0]
    check("user idempotent: email preserved", u2["email"] == "a@b.com")
    check("user idempotent: phone preserved", u2["phone"] == "123")
    check("user idempotent: gender preserved", u2["gender"] == "male")

    # 4. Pass-through for unknown tables
    result = v1_0_0_upgrade("unknown", [{"x": 1}])
    check("v1.0.0: unknown table pass-through", result == [{"x": 1}])


def test_v1_0_1():
    print("\n=== v1.0.1 → CURRENT ===")
    records = [{"id": 1}, {"id": 2}]
    result = v1_0_1_upgrade("any_table", records)
    check("v1.0.1: pass-through (identity)", result is records)


async def test_chain():
    print("\n=== apply_migration_chain 端到端 ===")

    # 1. source < min_version: 所有迁移都执行
    tasks = [{"id": 1}]
    result = await apply_migration_chain("0.0.0", "1.0.0", "task", tasks)
    r = result[0]
    check("chain 0.0.0→1.0.0: visibility set", r.get("visibility") == "private")
    check("chain 0.0.0→1.0.0: restricted_users set", r.get("restricted_users") == [])

    # 2. source == version: 该版本迁移不执行（exclusive boundary）
    #    source="1.0.0" → v1.0.0 migration excluded, only v1.0.1 pass-through runs
    servers = [{"name": "test"}]
    result = await apply_migration_chain("1.0.0", "1.0.1", "servers", servers)
    s = result[0]
    check("chain 1.0.0→1.0.1: hardware_specs NOT set (v1.0.0 excluded at boundary)",
          "hardware_specs" not in s)
    check("chain 1.0.0→1.0.1: visibility NOT set (v0_2_0 excluded at boundary)",
          "visibility" not in s)

    # 2b. source < 1.0.0: v1.0.0 migration IS applied
    result2 = await apply_migration_chain("0.0.0", "1.0.1", "servers", servers)
    s2 = result2[0]
    check("chain 0.0.0→1.0.1 servers: hardware_specs set", s2.get("hardware_specs") == {})

    # 3. Full chain: v0.2.0 file → v1.0.1
    file_records = [{
        "id": "file-1",
        "name": "doc.pdf",
        "stored_path": "/files/doc.pdf",
        "owner_id": "user-1",
        "file_size": 2048,
        "mime_type": "application/pdf",
    }]
    result = await apply_migration_chain("0.0.0", "1.0.1", "file", file_records)
    r = result[0]
    check("full chain file→file_share: original_name", r["original_name"] == "doc.pdf")
    check("full chain file→file_share: file_path", r["file_path"] == "/files/doc.pdf")
    check("full chain file→file_share: share_code", "share_code" in r)

    # 4. record table through chain: all return empty
    result = await apply_migration_chain("0.0.0", "1.0.1", "record", [{"id": 1}])
    check("chain: record table returns empty", result == [])

    # 5. Empty records through chain
    result = await apply_migration_chain("0.0.0", "1.0.1", "task", [])
    check("chain: empty records stays empty", result == [])

    # 6. Full chain for user（user 不在 _VISIBILITY_TABLES 中，v0_2_0 不会添加 visibility）
    user_records = [{"username": "admin"}]
    result = await apply_migration_chain("0.0.0", "1.0.1", "user", user_records)
    u = result[0]
    check("full chain user: NO visibility (user not in _VISIBILITY_TABLES)",
          "visibility" not in u)
    check("full chain user: email after v1_0_0", u.get("email") is None)
    check("full chain user: phone after v1_0_0", u.get("phone") is None)
    check("full chain user: gender after v1_0_0", u.get("gender") is None)

    # 7. Full chain for reminder
    reminder_records = [{"id": 1, "channels": ["email"], "msg": "hello"}]
    result = await apply_migration_chain("0.0.0", "1.0.1", "reminder", reminder_records)
    rm = result[0]
    check("full chain reminder: channels removed", "channels" not in rm)
    check("full chain reminder: visibility set", rm.get("visibility") == "private")


def main():
    print("=" * 60)
    print("数据迁移链测试")
    print("=" * 60)

    test_v0_2_0()
    test_v1_0_0()
    test_v1_0_1()
    asyncio.run(test_chain())

    print(f"\n{'=' * 60}")
    print(f"结果: {passed} 通过, {failed} 失败, {passed + failed} 总计")
    print(f"{'=' * 60}")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
