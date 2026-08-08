"""v0.2.0 → v1.0.0 数据迁移

关键变更：
- 15 张表新增 visibility/restricted_users 字段 → 默认 "private" / []
- record 表被跳过（后续版本中已删除该表）
- file 表数据映射到 file_share 格式
"""

from __future__ import annotations

import random
import string
from datetime import datetime, timedelta, timezone


# 需要新增 visibility/restricted_users 默认值的表
_VISIBILITY_TABLES: set[str] = {
    "inventory",
    "contact",
    "budget",
    "subscription",
    "task",
    "note",
    "calendar_event",
    "secret",
    "secret_category",
    "template",
    "reminder",
    "project",
    "server",
    "vote",
}

# 已被删除的表：迁移时静默跳过，返回空列表
_DROPPED_TABLES: set[str] = {"record"}


def upgrade(table_name: str, records: list[dict]) -> list[dict]:
    """将 v0.2.0 格式的数据迁移到 v1.0.0 格式。

    Args:
        table_name: 表名。
        records:    v0.2.0 格式的记录列表。

    Returns:
        v1.0.0 格式的记录列表。
    """
    # 已删除的表：返回空列表
    if table_name in _DROPPED_TABLES:
        return []

    # file 表 → file_share 格式映射
    if table_name == "file":
        return _migrate_file_to_file_share(records)

    # 需要 visibility 默认值的表
    if table_name in _VISIBILITY_TABLES:
        return _apply_visibility_defaults(records)

    # 其他表：直接透传
    return records


def _apply_visibility_defaults(records: list[dict]) -> list[dict]:
    """为每条记录添加 visibility 和 restricted_users 默认值（如果缺失）。"""
    for r in records:
        r.setdefault("visibility", "private")
        r.setdefault("restricted_users", [])
    return records


def _migrate_file_to_file_share(records: list[dict]) -> list[dict]:
    """将旧 file 表记录映射到 file_share 格式。"""
    result: list[dict] = []
    for r in records:
        new_record: dict = {
            "id": r.get("id"),
            "original_name": r.get("name"),
            "file_path": r.get("stored_path"),
            "owner_id": r.get("owner_id"),
            "file_size": r.get("file_size"),
            "mime_type": r.get("mime_type"),
            "share_code": _generate_share_code(),
            # v1.0.0 新增字段的默认值
            "password_hash": None,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "max_downloads": None,
            "download_count": 0,
            "is_deleted": False,
            "deleted_at": None,
        }
        # 保留时间戳（如果旧记录中存在）
        if "created_at" in r:
            new_record["created_at"] = r["created_at"]
        if "updated_at" in r:
            new_record["updated_at"] = r["updated_at"]
        result.append(new_record)
    return result


def _generate_share_code(length: int = 8) -> str:
    """生成随机分享码：大写字母 + 数字。"""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))
