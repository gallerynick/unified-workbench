"""启动时执行 Alembic 迁移（幂等）。

先 Base.metadata.create_all（在 Dockerfile CMD 中完成），再检查 alembic_version 表：
- 若存在：直接 upgrade head
- 若不存在（create_all 首次建表）：先 stamp head 让版本指针指到最新，再 upgrade head 只运行增量迁移
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import create_engine, inspect

from app.core.config import get_settings

# 显式导入迁移脚本中的模型，确保 upgrade() 内引用的 ORM 类可用
# （env.py 的 autogenerate 不走，但 downgrade/upgrade 若引用模型类型需 import）
from alembic.config import Config
from alembic import command as alembic_command


def ensure_alembic_stamped() -> None:
    settings = get_settings()
    url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
    engine = create_engine(url)
    insp = inspect(engine)
    has_alembic = "alembic_version" in insp.get_table_names()
    engine.dispose()

    if not has_alembic:
        # 已有 create_all 建好表，但版本指针未初始化；先 stamp 到 head
        print("[db_migrate] alembic_version 不存在，执行 stamp head")
        cfg = Config("alembic.ini")
        cfg.set_main_option("script_location", "alembic")
        cfg.set_main_option("sqlalchemy.url", url)
        alembic_command.stamp(cfg, "head")


def upgrade_head() -> None:
    settings = get_settings()
    url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
    cfg = Config("alembic.ini")
    cfg.set_main_option("script_location", "alembic")
    cfg.set_main_option("sqlalchemy.url", url)
    alembic_command.upgrade(cfg, "head")


if __name__ == "__main__":
    try:
        ensure_alembic_stamped()
        upgrade_head()
        print("[db_migrate] 迁移完成")
    except Exception as exc:  # noqa: BLE001
        print(f"[db_migrate] 迁移失败：{exc}", file=sys.stderr)
        sys.exit(1)
