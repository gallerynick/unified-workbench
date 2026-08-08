"""移除提醒表 event_type 列

Revision ID: 031
Revises: 030
Create Date: 2026-08-07
"""

from collections.abc import Sequence

from alembic import op

revision: str = "031"
down_revision: str | None = "030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS reminder DROP COLUMN IF EXISTS event_type")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE IF EXISTS reminder ADD COLUMN IF NOT EXISTS event_type VARCHAR(50)"
    )
