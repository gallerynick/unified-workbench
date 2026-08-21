"""项目提案评论表 — 为提案详情页新增评论系统。

Revision ID: 038
Revises: 037
Create Date: 2026-08-15

变更内容：
1. 新建 project_proposal_comment 表，包含 id / proposal_id / creator_id / content / created_at
2. 为 proposal_id 建立索引
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "038"
down_revision: str | None = "037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_proposal_comment",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column(
            "proposal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("project_proposal.id", ondelete="CASCADE"),
            nullable=False,
            comment="所属提案ID",
        ),
        sa.Column(
            "creator_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            comment="创建者ID",
        ),
        sa.Column(
            "content",
            sa.Text(),
            nullable=False,
            comment="评论内容",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_project_proposal_comment_proposal_id",
        "project_proposal_comment",
        ["proposal_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_project_proposal_comment_proposal_id",
        table_name="project_proposal_comment",
    )
    op.drop_table("project_proposal_comment")