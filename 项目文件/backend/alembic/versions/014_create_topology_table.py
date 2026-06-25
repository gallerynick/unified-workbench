"""新建 topology 拓扑管理表

Revision ID: 014
Revises: 013
Create Date: 2026-06-23

变更内容：
1. 新建 topology 表，存储网络/设备拓扑图（节点 + 连线 JSONB）
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""
    op.create_table(
        "topology",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            comment="拓扑 ID",
        ),
        sa.Column("name", sa.String(200), nullable=False, comment="拓扑名称"),
        sa.Column("description", sa.Text(), nullable=True, comment="描述"),
        sa.Column(
            "nodes",
            JSONB,
            nullable=False,
            server_default="[]",
            comment="节点列表",
        ),
        sa.Column(
            "edges",
            JSONB,
            nullable=False,
            server_default="[]",
            comment="连线列表",
        ),
        sa.Column(
            "owner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id"),
            nullable=False,
            comment="所有者 ID",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="更新时间",
        ),
    )
    op.create_index("ix_topology_owner_id", "topology", ["owner_id"])


def downgrade() -> None:
    """回滚迁移"""
    op.drop_index("ix_topology_owner_id", table_name="topology")
    op.drop_table("topology")