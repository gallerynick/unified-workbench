"""v1.0.1 → CURRENT 数据迁移

当前无 schema 变更，直通透传。
"""

from __future__ import annotations


def upgrade(table_name: str, records: list[dict]) -> list[dict]:
    """将 v1.0.1 格式的数据迁移到当前版本。

    当前版本与 v1.0.1 之间无 schema 变更，直接返回原记录。

    Args:
        table_name: 表名。
        records:    v1.0.1 格式的记录列表。

    Returns:
        未经修改的记录列表。
    """
    return records
