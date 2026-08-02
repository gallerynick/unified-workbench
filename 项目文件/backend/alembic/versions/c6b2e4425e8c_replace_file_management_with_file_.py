"""replace_file_management_with_file_sharing

Revision ID: c6b2e4425e8c
Revises: 018
Create Date: 2026-08-02 13:05:06.226915
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "c6b2e4425e8c"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 删除旧的文件管理表（顺序遵守外键约束）
    op.drop_table("content_file")
    op.drop_table("file")
    op.drop_table("folder")

    # 创建新的文件分享表
    op.create_table(
        "file_shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("stored_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(512), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.String(255), nullable=True),
        sa.Column("share_code", sa.String(12), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("max_downloads", sa.Integer(), nullable=True),
        sa.Column("download_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_file_shares_share_code", "file_shares", ["share_code"], unique=True)


def downgrade() -> None:
    # 删除文件分享表
    op.drop_index("ix_file_shares_share_code", table_name="file_shares")
    op.drop_table("file_shares")

    # 重建文件夹表
    op.create_table(
        "folder",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("folder.id"), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("visibility", sa.String(20), nullable=False, server_default=sa.text("'private'")),
        sa.Column("restricted_users", postgresql.JSONB(), nullable=True),
        sa.Column("restricted_tags", postgresql.JSONB(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("unified_management", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # 重建文件表
    op.create_table(
        "file",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("stored_path", sa.String(500), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("folder.id"), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("visibility", sa.String(20), nullable=False, server_default=sa.text("'private'")),
        sa.Column("restricted_users", postgresql.JSONB(), nullable=True),
        sa.Column("restricted_tags", postgresql.JSONB(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # 重建内容-文件关联表
    op.create_table(
        "content_file",
        sa.Column("content_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content.id"), primary_key=True),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("file.id"), primary_key=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
