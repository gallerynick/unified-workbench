"""删除会议记录编号列

Revision ID: 052
Revises: 051
Create Date: 2026-10-06

变更内容：
- 删除 meeting_record.number 列（含唯一约束 meeting_record_number_key），
  会议编号（MTG-YYYYMMDD-NNN）不再存在。

数据说明：
- 会议编号此前仅用于展示/导出，无业务关联，直接删除无兼容负担。

回滚说明：
- downgrade() 重建 number 列（String(50), NOT NULL, UNIQUE），
  但存量行的编号值不可恢复（由下游自行决定是否需要回填）。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "052"
down_revision: str | None = "051"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """删除 meeting_record.number 列及其唯一约束"""
    op.drop_constraint("meeting_record_number_key", "meeting_record", type_="unique")
    op.drop_column("meeting_record", "number")


def downgrade() -> None:
    """重建 number 列（存量值不回填）"""
    op.add_column(
        "meeting_record",
        sa.Column(
            "number",
            sa.String(length=50),
            nullable=False,
            server_default="",
            comment="会议编号 MTG-YYYYMMDD-NNN",
        ),
    )
    op.create_unique_constraint("meeting_record_number_key", "meeting_record", ["number"])
