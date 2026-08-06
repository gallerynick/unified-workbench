"""用户表添加联系方式字段（邮箱、手机、性别）

Revision ID: 029
Revises: 028
Create Date: 2026-08-06
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "029"
down_revision: str | None = "028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 使用 op.add_column + try/except 实现 IF NOT EXISTS 模式
    columns = [
        ("email", sa.Column("email", sa.String(200), nullable=True)),
        ("phone", sa.Column("phone", sa.String(30), nullable=True)),
        ("gender", sa.Column("gender", sa.String(10), nullable=True)),
    ]

    for name, column in columns:
        try:
            op.add_column("user", column)
        except Exception:
            pass  # 列已存在，跳过

    # 邮箱唯一约束（独立创建，同样使用 try/except）
    try:
        op.create_unique_constraint("uq_user_email", "user", ["email"])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_constraint("uq_user_email", "user", type_="unique")
    except Exception:
        pass
    op.drop_column("user", "email")
    op.drop_column("user", "phone")
    op.drop_column("user", "gender")
