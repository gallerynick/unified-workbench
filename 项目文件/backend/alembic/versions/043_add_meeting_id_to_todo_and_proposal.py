"""project_todo、project_proposal 表新增 meeting_id 外键 — 实现待办/提案 ↔ 交流 双向关联。

Revision ID: 043
Revises: 042
Create Date: 2026-08-31

变更内容：
1. project_todo 新增 meeting_id（UUID，nullable，FK → project_meeting.id，ondelete SET NULL）
2. project_proposal 新增 meeting_id（UUID，nullable，FK → project_meeting.id，ondelete SET NULL）
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "043"
down_revision: str | None = "042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "project_todo",
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("project_meeting.id", ondelete="SET NULL"),
            nullable=True,
            comment="关联交流记录ID",
        ),
    )
    op.add_column(
        "project_proposal",
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("project_meeting.id", ondelete="SET NULL"),
            nullable=True,
            comment="关联交流记录ID",
        ),
    )


def downgrade() -> None:
    op.drop_column("project_proposal", "meeting_id")
    op.drop_column("project_todo", "meeting_id")
