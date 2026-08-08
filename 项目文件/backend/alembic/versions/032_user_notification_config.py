"""创建 user_notification_config 表，移除 reminder 表 channels 列

Revision ID: 032
Revises: 031
Create Date: 2026-08-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "032"
down_revision: str | None = "031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_notification_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "enabled_channels",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("feishu_webhook_url", sa.String(500), nullable=True),
        sa.Column("wecom_webhook_url", sa.String(500), nullable=True),
        sa.Column("email_enabled", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("smtp_host", sa.String(200), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=True),
        sa.Column("smtp_user", sa.String(200), nullable=True),
        sa.Column("smtp_password", sa.String(200), nullable=True),
        sa.Column("smtp_use_tls", sa.Boolean(), nullable=True, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.execute("ALTER TABLE IF EXISTS reminder DROP COLUMN IF EXISTS channels")


def downgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS reminder ADD COLUMN IF NOT EXISTS channels JSONB")
    op.drop_table("user_notification_config")
