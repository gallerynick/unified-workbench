"""日历事件表添加提醒字段

Revision ID: 030
Revises: 029
Create Date: 2026-08-07
"""

from collections.abc import Sequence

from alembic import op

revision: str = "030"
down_revision: str | None = "029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE IF EXISTS calendar_event "
        "ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT FALSE"
    )
    op.execute(
        "ALTER TABLE IF EXISTS calendar_event "
        "ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 15"
    )
    op.execute(
        "ALTER TABLE IF EXISTS calendar_event "
        "ADD COLUMN IF NOT EXISTS reminded BOOLEAN DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS calendar_event DROP COLUMN IF EXISTS reminder_enabled")
    op.execute("ALTER TABLE IF EXISTS calendar_event DROP COLUMN IF EXISTS reminder_minutes")
    op.execute("ALTER TABLE IF EXISTS calendar_event DROP COLUMN IF EXISTS reminded")
