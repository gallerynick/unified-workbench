"""finance tables

Revision ID: 006
Revises: 005
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "budget",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("spent", sa.Float(), server_default="0"),
        sa.Column("period", sa.String(20), server_default="monthly"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_budget_owner_id", "budget", ["owner_id"])

    op.create_table(
        "subscription",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("billing_cycle", sa.String(20), server_default="monthly"),
        sa.Column("next_billing", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscription_owner_id", "subscription", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_subscription_owner_id", table_name="subscription")
    op.drop_table("subscription")
    op.drop_index("ix_budget_owner_id", table_name="budget")
    op.drop_table("budget")
