"""新增双因素认证 2FA 相关表：user_totp、user_recovery_code。

Revision ID: 042
Revises: 041
Create Date: 2026-08-28

变更内容：
1. 新增 user_totp 表（多设备 TOTP 绑定，密钥 AES-256-GCM 加密存储）
2. 新增 user_recovery_code 表（一次性恢复码，bcrypt 哈希存储）
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "042"
down_revision: str | None = "041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_totp",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "secret_encrypted",
            sa.Text(),
            nullable=False,
            comment="AES-256-GCM 加密的 TOTP 密钥",
        ),
        sa.Column(
            "label", sa.String(100), nullable=False, comment="设备/认证器名称"
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="是否已完成激活",
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_user_totp_user_id", "user_totp", ["user_id"])

    op.create_table(
        "user_recovery_code",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "code_hash",
            sa.String(128),
            nullable=False,
            comment="恢复码 bcrypt 哈希",
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_user_recovery_code_user_id", "user_recovery_code", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_recovery_code_user_id", table_name="user_recovery_code")
    op.drop_table("user_recovery_code")
    op.drop_index("ix_user_totp_user_id", table_name="user_totp")
    op.drop_table("user_totp")
