"""11 模块加 visibility + restricted_users + project 加 member_ids

Revision ID: 027
Revises: 026
Create Date: 2026-08-06
"""

from collections.abc import Sequence

from alembic import op

TABLES = [
    "inventory",
    "contacts",
    "budget",
    "subscription",
    "tasks",
    "notes",
    "calendar_events",
    "secrets",
    "secret_categories",
    "templates",
    "reminders",
]

revision: str = "027"
down_revision: str | None = "026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in TABLES:
        op.execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private'"
        )
        op.execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS restricted_users JSONB DEFAULT '[]'::jsonb"
        )
    op.execute(
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS member_ids JSONB DEFAULT '[]'::jsonb"
    )


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS visibility")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS restricted_users")
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS member_ids")
