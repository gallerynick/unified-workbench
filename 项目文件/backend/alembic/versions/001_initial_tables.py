"""初始表结构

Revision ID: 001
Revises: 
Create Date: 2026-06-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建初始表结构"""

    # 创建枚举类型（PostgreSQL 专用）
    user_role_enum = sa.Enum("admin", "member", name="userrole")
    user_status_enum = sa.Enum("active", "disabled", name="userstatus")
    user_role_enum.create(op.get_bind(), checkfirst=True)
    user_status_enum.create(op.get_bind(), checkfirst=True)

    # 创建 user 表
    op.create_table(
        "user",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, index=True, nullable=False),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("nickname", sa.String(50), nullable=False),
        sa.Column("avatar", sa.String(255), nullable=True),
        sa.Column("role", user_role_enum, nullable=False, server_default="member"),
        sa.Column("status", user_status_enum, nullable=False, server_default="active"),
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

    # 创建 tag 表
    op.create_table(
        "tag",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 创建 user_tag 关联表
    op.create_table(
        "user_tag",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("user.id"), primary_key=True),
        sa.Column("tag_id", sa.Uuid(), sa.ForeignKey("tag.id"), primary_key=True),
    )


def downgrade() -> None:
    """回滚初始表结构"""

    op.drop_table("user_tag")
    op.drop_table("tag")
    op.drop_table("user")

    # 删除枚举类型
    sa.Enum(name="userstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="userrole").drop(op.get_bind(), checkfirst=True)
