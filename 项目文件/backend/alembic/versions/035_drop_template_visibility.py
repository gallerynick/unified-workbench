"""模板表移除可见性 — template 属于系统设置，管理仅限管理员，使用全员公开。

Revision ID: 035
Revises: 034
Create Date: 2026-08-11

变更内容：
1. 删除 template.visibility 列（默认 private，全员公开后无意义）
2. 删除 template.restricted_users 列（可见性体系的依赖列）
"""

from collections.abc import Sequence

from alembic import op

revision: str = "035"
down_revision: str | None = "034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 先删依赖列 restricted_users，再删 visibility
    op.execute("ALTER TABLE template DROP COLUMN IF EXISTS restricted_users")
    op.execute("ALTER TABLE template DROP COLUMN IF EXISTS visibility")


def downgrade() -> None:
    # 与 027 迁移新增列的方式保持一致
    op.execute(
        "ALTER TABLE template ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private'"
    )
    op.execute(
        "ALTER TABLE template ADD COLUMN IF NOT EXISTS restricted_users JSONB DEFAULT '[]'::jsonb"
    )
