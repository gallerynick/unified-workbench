"""user 表新增 preferences 字段 — 存储用户偏好设置（JSONB）。

Revision ID: 039
Revises: 038
Create Date: 2026-08-15

变更内容：
1. user 表新增 preferences（JSONB，nullable）字段，用于存储用户个性化偏好
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "039"
down_revision: str | None = "038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column(
            "preferences",
            postgresql.JSONB,
            nullable=True,
            comment="用户偏好设置（JSONB），例如 {\"page_zoom\": \"100\"}",
        ),
    )


def downgrade() -> None:
    op.drop_column("user", "preferences")