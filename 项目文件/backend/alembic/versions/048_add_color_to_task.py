"""task 表新增 color 列（卡片左侧标记色）

Revision ID: 048
Revises: 047
Create Date: 2026-09-16

变更内容：
task 表新增 color 列（VARCHAR(20) NOT NULL DEFAULT 'blue'）：
任务卡片左侧标记条的颜色，取值见 app/schemas/task.py 的 VALID_COLORS。
存量任务统一回填默认色 'blue'。

部署说明：
- 线上库未初始化 alembic_version，本迁移不会自动执行；同等变更已以
  幂等 inline SQL 写入 app/startup_migrate.py（该脚本由 Dockerfile CMD
  在每次启动时执行）。两处必须保持同等变更。
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "048"
down_revision: str | None = "047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """task 加 color 列，存量行回填默认色 blue"""
    op.add_column(
        "task",
        sa.Column(
            "color",
            sa.String(length=20),
            nullable=False,
            server_default="blue",
        ),
    )


def downgrade() -> None:
    """回滚：删除 color 列"""
    op.drop_column("task", "color")
