"""将 user 表的 avatar 列从 VARCHAR(255) 改为 TEXT

Revision ID: 013
Revises: 012
Create Date: 2026-06-23

变更内容：
1. 将 user.avatar 列类型从 VARCHAR(255) 改为 TEXT
   支持存储 base64 data URL（头像上传功能需要）
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """将 avatar 列改为 TEXT 类型"""
    op.alter_column(
        "user",
        "avatar",
        type_=sa.Text(),
        existing_type=sa.String(255),
        nullable=True,
    )


def downgrade() -> None:
    """将 avatar 列改回 VARCHAR(255)"""
    op.alter_column(
        "user",
        "avatar",
        type_=sa.String(255),
        existing_type=sa.Text(),
        nullable=True,
    )