"""project: add status_log JSONB column

Revision ID: 026
Revises: 025
Create Date: 2026-08-05
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "026"
down_revision: str | None = "025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("project", sa.Column("status_log", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("project", "status_log")

