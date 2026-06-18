"""P3 提醒阶段 — reminder + system_config 表

Revision ID: 004
Revises: 003
Create Date: 2026-06-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建 P3 提醒阶段表结构"""

    # 创建 reminder 表
    op.create_table(
        "reminder",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("title", sa.String(200), nullable=False, comment="提醒标题"),
        sa.Column("content", sa.Text(), nullable=True, comment="提醒内容"),
        sa.Column(
            "trigger_type",
            sa.String(20),
            nullable=False,
            comment="触发类型: timed/event",
        ),
        sa.Column(
            "event_type",
            sa.String(50),
            nullable=True,
            comment="事件类型（仅 event 触发类型使用）",
        ),
        sa.Column(
            "trigger_time",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="定时触发时间",
        ),
        sa.Column(
            "target_users", JSONB, nullable=True, comment="目标用户ID数组"
        ),
        sa.Column(
            "channels",
            JSONB,
            nullable=True,
            comment="推送渠道配置: websocket/email/wechat等",
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
            comment="状态: pending/sent/failed/cancelled",
        ),
        sa.Column(
            "creator_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id"),
            nullable=False,
            comment="创建者ID",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            comment="创建时间",
        ),
    )

    # reminder 表索引
    op.create_index("ix_reminder_status", "reminder", ["status"])
    op.create_index("ix_reminder_trigger_time", "reminder", ["trigger_time"])
    op.create_index("ix_reminder_creator_id", "reminder", ["creator_id"])

    # 创建 system_config 表
    op.create_table(
        "system_config",
        sa.Column(
            "key", sa.String(100), primary_key=True, comment="配置键"
        ),
        sa.Column("value", JSONB, nullable=False, comment="配置值(JSON)"),
    )


def downgrade() -> None:
    """回滚 P3 提醒阶段表结构"""

    op.drop_table("system_config")
    op.drop_index("ix_reminder_creator_id", table_name="reminder")
    op.drop_index("ix_reminder_trigger_time", table_name="reminder")
    op.drop_index("ix_reminder_status", table_name="reminder")
    op.drop_table("reminder")
