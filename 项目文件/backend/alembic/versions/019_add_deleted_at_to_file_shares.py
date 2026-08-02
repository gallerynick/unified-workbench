"""add deleted_at to file_shares

Revision ID: 019
Revises: c6b2e4425e8c
Create Date: 2026-08-02

变更内容：
1. file_shares 表新增 deleted_at 列 (TIMESTAMP NULL)
   — 记录文件分享被标记删除的时间，用于宽限期两阶段清理
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "019"
down_revision: Union[str, None] = "c6b2e4425e8c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("file_shares", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("file_shares", "deleted_at")
