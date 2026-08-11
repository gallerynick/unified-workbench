"""project 表新增开源仓库地址字段。

Revision ID: 037
Revises: 036
Create Date: 2026-08-11

变更内容：
1. project 表新增 repo_url（String(500)，nullable）开源仓库地址
"""

from collections.abc import Sequence

from alembic import op

revision: str = "037"
down_revision: str | None = "036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ADD COLUMN IF NOT EXISTS，保证幂等
    op.execute(
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS repo_url VARCHAR(500)"
    )


def downgrade() -> None:
    # DROP COLUMN IF EXISTS，保证幂等
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS repo_url")
