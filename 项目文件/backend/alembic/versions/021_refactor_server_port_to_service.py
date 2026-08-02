"""服务端口归属重构：servers.port 迁移至 services.port

Revision ID: 021
Revises: 020
Create Date: 2026-08-02

变更内容：
1. 删除 servers 表的 port 列（端口归属下移到服务层级）
2. 删除 services 表的 target_ref 列（不再使用目标引用键）
3. 在 services 表新增 port 列（INTEGER，可空，服务端口）
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""
    # 1. 删除 servers 表的 port 列
    op.drop_column("servers", "port")
    # 2. 删除 services 表的 target_ref 列
    op.drop_column("services", "target_ref")
    # 3. 新增 services 表的 port 列
    op.add_column("services", sa.Column("port", sa.Integer(), nullable=True, comment="服务端口"))


def downgrade() -> None:
    """回滚迁移"""
    # 1. 删除 services 表的 port 列
    op.drop_column("services", "port")
    # 2. 恢复 services 表的 target_ref 列
    op.add_column(
        "services",
        sa.Column("target_ref", sa.UUID(as_uuid=True), nullable=True, comment="目标引用键"),
    )
    # 3. 恢复 servers 表的 port 列
    op.add_column("servers", sa.Column("port", sa.Integer(), nullable=True, comment="端口"))
