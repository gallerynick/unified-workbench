"""project_meeting 表新增 proposal_id 外键字段 — 关联会议到提案。

Revision ID: 040
Revises: 039
Create Date: 2026-08-15

变更内容：
1. project_meeting 表新增 proposal_id（UUID，nullable，FK → project_proposal.id，ondelete SET NULL）
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "040"
down_revision: str | None = "039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "project_meeting",
        sa.Column(
            "proposal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("project_proposal.id", ondelete="SET NULL"),
            nullable=True,
            comment="关联提案ID",
        ),
    )


def downgrade() -> None:
    op.drop_column("project_meeting", "proposal_id")