"""项目表新增信息扩展字段 — 源自开发手册 6.1 项目策划设计表。

Revision ID: 036
Revises: 035
Create Date: 2026-08-11

变更内容：
1. project 表新增 11 个字段：
   - department（String(50)，nullable）所属团队/部门
   - language（String(30)，nullable）项目语言
   - is_open_source（Boolean，NOT NULL 默认 false）是否开源
   - priority（String(20)，NOT NULL 默认 '待定'）项目优先级
   - project_type（String(30)，nullable）项目类型
   - goals / requirements / additional_req / modules / related_projects / dev_process（Text，nullable）
"""

from collections.abc import Sequence

from alembic import op

revision: str = "036"
down_revision: str | None = "035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 逐列 ADD COLUMN IF NOT EXISTS，保证幂等
    op.execute(
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS department VARCHAR(50)"
    )
    op.execute(
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS language VARCHAR(30)"
    )
    op.execute(
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS is_open_source BOOLEAN NOT NULL DEFAULT false"
    )
    op.execute(
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT '待定'"
    )
    op.execute(
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS project_type VARCHAR(30)"
    )
    op.execute("ALTER TABLE project ADD COLUMN IF NOT EXISTS goals TEXT")
    op.execute("ALTER TABLE project ADD COLUMN IF NOT EXISTS requirements TEXT")
    op.execute("ALTER TABLE project ADD COLUMN IF NOT EXISTS additional_req TEXT")
    op.execute("ALTER TABLE project ADD COLUMN IF NOT EXISTS modules TEXT")
    op.execute(
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS related_projects TEXT"
    )
    op.execute("ALTER TABLE project ADD COLUMN IF NOT EXISTS dev_process TEXT")


def downgrade() -> None:
    # 逐列 DROP COLUMN IF EXISTS，保证幂等
    for column in (
        "department",
        "language",
        "is_open_source",
        "priority",
        "project_type",
        "goals",
        "requirements",
        "additional_req",
        "modules",
        "related_projects",
        "dev_process",
    ):
        op.execute(f"ALTER TABLE project DROP COLUMN IF EXISTS {column}")
