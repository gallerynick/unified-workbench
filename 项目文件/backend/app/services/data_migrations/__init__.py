"""跨版本数据迁移链

将导入数据从旧版本格式升级到当前版本格式。
"""

from __future__ import annotations

import importlib
from typing import Protocol


# 迁移函数签名协议
class UpgradeFunc(Protocol):
    def __call__(self, table_name: str, records: list[dict]) -> list[dict]: ...


# 迁移链：按版本升序排列，每个元素为 (版本号, 模块全限定名)
MIGRATION_CHAIN: list[tuple[str, str]] = [
    ("0.2.0", "app.services.data_migrations.v0_2_0"),
    ("1.0.0", "app.services.data_migrations.v1_0_0"),
    ("1.0.1", "app.services.data_migrations.v1_0_1"),
]


async def apply_migration_chain(
    source_version: str,
    target_version: str,
    table_name: str,
    records: list[dict],
) -> list[dict]:
    """对 records 按序执行 source_version（不含）到 target_version（含）之间的所有迁移函数。

    Args:
        source_version: 数据来源版本（该版本之后的迁移将被执行）
        target_version: 目标版本（该版本及之前的迁移将被执行）
        table_name:    当前迁移的表名
        records:       原始记录列表

    Returns:
        迁移转换后的记录列表。

    Raises:
        ValueError: 当任一迁移函数标记该表为不兼容时抛出。
    """
    transformed = list(records)

    for version, module_name in MIGRATION_CHAIN:
        # 仅处理 source_version < version <= target_version 范围内的迁移
        if not _version_gt(version, source_version):
            continue
        if _version_gt(version, target_version):
            break

        mod = importlib.import_module(module_name)
        upgrade: UpgradeFunc = getattr(mod, "upgrade")
        transformed = upgrade(table_name, transformed)

    return transformed


def _version_gt(a: str, b: str) -> bool:
    """语义化版本比较：a > b 返回 True。"""
    parts_a = tuple(int(x) for x in a.split("."))
    parts_b = tuple(int(x) for x in b.split("."))
    return parts_a > parts_b
