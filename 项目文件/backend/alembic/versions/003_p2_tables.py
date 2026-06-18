"""P2 特色功能表结构

Revision ID: 003
Revises: 002
Create Date: 2026-06-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建 P2 特色功能表结构"""

    # 创建 template 表
    op.create_table(
        "template",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, comment="模板名称"),
        sa.Column(
            "category",
            sa.String(50),
            nullable=False,
            server_default="默认",
            comment="分类",
        ),
        sa.Column("schema", JSONB, nullable=False, comment="字段定义数组"),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default="1",
            comment="版本号",
        ),
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

    # 创建 record 表
    op.create_table(
        "record",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "template_id",
            UUID(as_uuid=True),
            sa.ForeignKey("template.id"),
            nullable=False,
        ),
        sa.Column(
            "template_snapshot", JSONB, nullable=False, comment="创建时的模板schema副本"
        ),
        sa.Column(
            "data",
            JSONB,
            nullable=False,
            server_default="{}",
            comment="用户填写的字段值",
        ),
        sa.Column(
            "type",
            sa.String(20),
            nullable=False,
            server_default="record",
            comment="project/record",
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="draft",
            comment="状态流转",
        ),
        sa.Column("title", sa.String(200), nullable=False, comment="记录标题"),
        sa.Column(
            "owner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id"),
            nullable=False,
        ),
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
        ),
        sa.Column("restricted_users", JSONB, nullable=True),
        sa.Column("restricted_tags", JSONB, nullable=True),
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

    # 创建 secret 表
    op.create_table(
        "secret",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, comment="名称"),
        sa.Column(
            "secret_type",
            sa.String(20),
            nullable=False,
            server_default="other",
            comment="api_key/account/config/other",
        ),
        sa.Column(
            "encrypted_data",
            sa.LargeBinary(),
            nullable=False,
            comment="AES-256-GCM 加密数据",
        ),
        sa.Column(
            "note",
            sa.String(500),
            nullable=False,
            server_default="",
            comment="备注（明文）",
        ),
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
    """回滚 P2 特色功能表结构"""

    op.drop_table("secret")
    op.drop_table("record")
    op.drop_table("template")
