"""创建 stream_room 直播间表 + 清理旧 stream 配置

Revision ID: 018
Revises: 017
Create Date: 2026-07-03

变更内容：
1. 新建 stream_room 表（直播间核心模型）
2. 删除 system_config 中旧的 stream_keys 和 stream_config 条目（已被 per-room config 取代）
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移：创建 stream_room 表 + 清理旧配置"""
    op.create_table(
        "stream_room",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            comment="房间 ID（即推流密钥）",
        ),
        sa.Column("name", sa.String(100), nullable=False, comment="房间名称"),
        sa.Column(
            "creator_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id"),
            nullable=False,
            comment="创建者",
        ),
        sa.Column(
            "mode",
            sa.String(10),
            nullable=False,
            server_default="builtin",
            comment="推流模式: builtin(内置WHIP) / external(外部RTMP)",
        ),
        sa.Column(
            "room_type",
            sa.String(10),
            nullable=False,
            server_default="permanent",
            comment="房间类型: temporary(临时) / permanent(常驻)",
        ),
        sa.Column(
            "config",
            JSONB,
            nullable=True,
            comment="per-room 配置(bitrate/resolution/fps/audio)",
        ),
        sa.Column(
            "is_open",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="是否开放访问",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="当前是否有人推流",
        ),
        sa.Column(
            "pusher_id",
            UUID(as_uuid=True),
            nullable=True,
            comment="当前推流者 user_id",
        ),
        sa.Column(
            "last_active_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="最后活跃时间",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="创建时间",
        ),
    )
    op.create_index("ix_stream_room_creator_id", "stream_room", ["creator_id"])
    op.create_index("ix_stream_room_room_type", "stream_room", ["room_type"])

    # 清理旧的 stream 配置（已被 per-room config 取代）
    op.execute(
        "DELETE FROM system_config WHERE key IN ('stream_keys', 'stream_config')"
    )


def downgrade() -> None:
    """回滚迁移：删除 stream_room 表（旧配置不回写）"""
    op.drop_index("ix_stream_room_room_type", table_name="stream_room", if_exists=True)
    op.drop_index("ix_stream_room_creator_id", table_name="stream_room", if_exists=True)
    op.drop_table("stream_room")
