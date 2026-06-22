"""file/folder 过期时间与库存表

Revision ID: 009
Revises: 008
Create Date: 2026-06-21

变更内容：
1. file 表新增 expires_at 列
2. folder 表新增 expires_at、unified_management、visibility、restricted_users、restricted_tags 列
3. 新建 inventory 库存表
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""

    # ========== 1. file 表：新增过期时间列 ==========
    op.add_column(
        "file",
        sa.Column(
            "expires_at",
            sa.DateTime(),
            nullable=True,
            comment="文件过期时间",
        ),
    )

    # ========== 2. folder 表：新增列 ==========
    op.add_column(
        "folder",
        sa.Column(
            "expires_at",
            sa.DateTime(),
            nullable=True,
            comment="文件夹过期时间",
        ),
    )
    op.add_column(
        "folder",
        sa.Column(
            "unified_management",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="是否以文件夹统一管理",
        ),
    )
    op.add_column(
        "folder",
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
            comment="可见性",
        ),
    )
    op.add_column(
        "folder",
        sa.Column("restricted_users", JSONB, nullable=True),
    )
    op.add_column(
        "folder",
        sa.Column("restricted_tags", JSONB, nullable=True),
    )

    # ========== 3. 创建 inventory 库存表 ==========
    op.create_table(
        "inventory",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("tags", JSONB, nullable=True),
        sa.Column(
            "owner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    """回滚迁移"""

    # 3. 删除 inventory 表
    op.drop_table("inventory")

    # 2. folder 表：移除新增列
    op.drop_column("folder", "restricted_tags")
    op.drop_column("folder", "restricted_users")
    op.drop_column("folder", "visibility")
    op.drop_column("folder", "unified_management")
    op.drop_column("folder", "expires_at")

    # 1. file 表：移除过期时间列
    op.drop_column("file", "expires_at")
