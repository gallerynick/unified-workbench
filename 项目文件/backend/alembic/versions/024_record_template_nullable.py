"""record template_id/template_snapshot → nullable

Revision ID: 024
Revises: 023
Create Date: 2026-08-04
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "024"
down_revision: str | None = "023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("record", "template_id", existing_type=sa.UUID(), nullable=True)
    op.alter_column("record", "template_snapshot", existing_type=sa.JSON(), nullable=True)


def downgrade() -> None:
    op.alter_column("record", "template_id", existing_type=sa.UUID(), nullable=False)
    op.alter_column("record", "template_snapshot", existing_type=sa.JSON(), nullable=False)

