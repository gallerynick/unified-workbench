"""project_meeting 表新增 todo_id 外键字段 — 关联会议到待办。

Revision ID: 041
Revises: 040
Create Date: 2026-08-16

变更内容：
1. project_meeting 表新增 todo_id（UUID，nullable，FK → project_todo.id，ondelete SET NULL）
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "041"
down_revision: str | None = "040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "project_meeting",
        sa.Column(
            "todo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("project_todo.id", ondelete="SET NULL"),
            nullable=True,
            comment="关联待办ID",
        ),
    )


def downgrade() -> None:
    op.drop_column("project_meeting", "todo_id")