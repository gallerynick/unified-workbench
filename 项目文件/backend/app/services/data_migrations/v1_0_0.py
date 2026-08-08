"""v1.0.0 → v1.0.1 数据迁移

关键变更：
- servers 表：新增 hardware_specs 字段（默认 {}）
- reminder 表：移除 channels 字段（v1.0.1 中已删除）
- user 表：email/phone/gender 默认 null
"""

from __future__ import annotations


def upgrade(table_name: str, records: list[dict]) -> list[dict]:
    """将 v1.0.0 格式的数据迁移到 v1.0.1 格式。

    Args:
        table_name: 表名。
        records:    v1.0.0 格式的记录列表。

    Returns:
        v1.0.1 格式的记录列表。
    """
    if table_name == "servers":
        return _migrate_servers(records)

    if table_name == "reminder":
        return _migrate_reminder(records)

    if table_name == "user":
        return _migrate_user(records)

    # 其他表：透传
    return records


def _migrate_servers(records: list[dict]) -> list[dict]:
    """servers 表迁移：新增字段填充默认值。"""
    for r in records:
        r.setdefault("hardware_specs", {})
        r.setdefault("hostname", r.get("name", ""))
        r.setdefault("os", "")
        # ram_capacity 继承自 ram_gb（如果存在且 ram_capacity 缺失）
        if "ram_gb" in r:
            r.setdefault("ram_capacity", r["ram_gb"])
        r.setdefault("ram_unit", "GB")
        # disk_capacity 继承自 disk_gb（如果存在且 disk_capacity 缺失）
        if "disk_gb" in r:
            r.setdefault("disk_capacity", r["disk_gb"])
        r.setdefault("disk_unit", "GB")
    return records


def _migrate_reminder(records: list[dict]) -> list[dict]:
    """reminder 表迁移：移除 channels 字段。"""
    for r in records:
        r.pop("channels", None)
    return records


def _migrate_user(records: list[dict]) -> list[dict]:
    """user 表迁移：新增字段填充 None 默认值。"""
    for r in records:
        r.setdefault("email", None)
        r.setdefault("phone", None)
        r.setdefault("gender", None)
    return records
