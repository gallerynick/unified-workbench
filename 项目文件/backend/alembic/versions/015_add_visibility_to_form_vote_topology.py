"""add visibility to form vote topology

Revision ID: 015
Revises: 014
Create Date: 2026-06-23

变更内容：
1. form 表新增 visibility / restricted_users / restricted_tags 列
2. vote 表新增 visibility / restricted_users / restricted_tags 列
3. topology 表新增 visibility / restricted_users / restricted_tags 列
4. topology 表补建 topology_type 列（修正 014 迁移遗漏的既有 drift）

可见性三态模型：public（公开）/ private（私有，默认）/ restricted（受限）
- restricted_users：JSONB 数组，被授权查看的用户 ID 列表
- restricted_tags：JSONB 数组，被授权查看的标签名称列表
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""

    # ========== 1. form 表：新增可见性列 ==========
    op.add_column(
        "form",
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
            comment="可见性: public/private/restricted",
        ),
    )
    op.add_column("form", sa.Column("restricted_users", JSONB, nullable=True))
    op.add_column("form", sa.Column("restricted_tags", JSONB, nullable=True))

    # ========== 2. vote 表：新增可见性列 ==========
    op.add_column(
        "vote",
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
            comment="可见性: public/private/restricted",
        ),
    )
    op.add_column("vote", sa.Column("restricted_users", JSONB, nullable=True))
    op.add_column("vote", sa.Column("restricted_tags", JSONB, nullable=True))

    # ========== 3. topology 表：新增可见性列 ==========
    # 3a. 补建 topology_type 列（014 迁移遗漏，模型已有此列但 DB 缺失）
    op.add_column(
        "topology",
        sa.Column(
            "topology_type",
            sa.String(50),
            nullable=False,
            server_default="custom",
            comment="拓扑类型: device/network/custom",
        ),
    )
    # 3b. 可见性列
    op.add_column(
        "topology",
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
            comment="可见性: public/private/restricted",
        ),
    )
    op.add_column("topology", sa.Column("restricted_users", JSONB, nullable=True))
    op.add_column("topology", sa.Column("restricted_tags", JSONB, nullable=True))


def downgrade() -> None:
    """回滚迁移"""

    # 3. topology 表：移除可见性列 + topology_type
    op.drop_column("topology", "restricted_tags")
    op.drop_column("topology", "restricted_users")
    op.drop_column("topology", "visibility")
    op.drop_column("topology", "topology_type")

    # 2. vote 表：移除可见性列
    op.drop_column("vote", "restricted_tags")
    op.drop_column("vote", "restricted_users")
    op.drop_column("vote", "visibility")

    # 1. form 表：移除可见性列
    op.drop_column("form", "restricted_tags")
    op.drop_column("form", "restricted_users")
    op.drop_column("form", "visibility")
