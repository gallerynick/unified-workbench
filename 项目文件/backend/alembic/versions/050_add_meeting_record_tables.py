"""添加会议记录模块表

Revision ID: 050
Revises: 049
Create Date: 2026-09-25

变更内容：
新增会议记录模块的 3 张表：
- meeting_record: 会议记录主表
- meeting_transcript_segment: 转录句子表
- meeting_minutes: AI 纪要表

同时修改 system_config 表结构，添加 id、config_key、config_value、
description、updated_by、created_at、updated_at 字段。

回滚说明：
downgrade() 可删除所有新增表并恢复 system_config 原结构。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "050"
down_revision: str | None = "049"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """创建会议记录模块表"""
    
    # 1. 创建 meeting_record 表
    op.create_table(
        "meeting_record",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("number", sa.String(50), nullable=False, comment="会议编号"),
        sa.Column("title", sa.String(500), nullable=False, comment="会议标题"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False, comment="创建者ID"),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="private", comment="可见性"),
        sa.Column("restricted_users", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default="[]", comment="指定可见用户ID列表"),
        sa.Column("restricted_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default="[]", comment="指定可见标签ID列表"),
        sa.Column("status", sa.String(20), nullable=False, server_default="not_started", comment="状态"),
        sa.Column("paused_reason", sa.String(20), nullable=True, comment="暂停原因"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True, comment="开始时间"),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True, comment="结束时间"),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0", comment="累计转录时长"),
        sa.Column("audio_file_path", sa.String(500), nullable=True, comment="音频文件路径"),
        sa.Column("diarization_status", sa.String(20), nullable=False, server_default="pending", comment="说话人分离状态"),
        sa.Column("minutes_status", sa.String(20), nullable=False, server_default="pending", comment="纪要生成状态"),
        sa.Column("minutes_reviewed", sa.Boolean(), nullable=False, server_default="false", comment="纪要是否已审核"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_meeting_record_number", "meeting_record", ["number"], unique=True)
    op.create_index("ix_meeting_record_owner_id", "meeting_record", ["owner_id"])
    op.create_index("ix_meeting_record_status", "meeting_record", ["status"])
    
    # 2. 创建 meeting_transcript_segment 表
    op.create_table(
        "meeting_transcript_segment",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False, comment="会议ID"),
        sa.Column("seq", sa.Integer(), nullable=False, comment="序号"),
        sa.Column("text", sa.Text(), nullable=False, comment="句子文本"),
        sa.Column("audio_start_ms", sa.Integer(), nullable=False, comment="音频起始时间戳"),
        sa.Column("audio_end_ms", sa.Integer(), nullable=True, comment="音频结束时间戳"),
        sa.Column("speaker", sa.String(50), nullable=True, comment="说话人标签"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meeting_record.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_meeting_transcript_segment_meeting_id", "meeting_transcript_segment", ["meeting_id"])
    op.create_index("ix_meeting_transcript_segment_seq", "meeting_transcript_segment", ["meeting_id", "seq"], unique=True)
    
    # 3. 创建 meeting_minutes 表
    op.create_table(
        "meeting_minutes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False, comment="会议ID"),
        sa.Column("summary", sa.Text(), nullable=False, comment="总结"),
        sa.Column("key_points", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default="[]", comment="重点摘要数组"),
        sa.Column("todos", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default="[]", comment="待办事项数组"),
        sa.Column("model_used", sa.String(100), nullable=False, comment="生成时用的模型名"),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, comment="生成时间"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meeting_record.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_meeting_minutes_meeting_id", "meeting_minutes", ["meeting_id"], unique=True)
    
    # 4. 修改 system_config 表结构
    # 添加新字段
    op.add_column("system_config", sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("(uuid_generate_v4())")))
    op.add_column("system_config", sa.Column("config_key", sa.String(100), nullable=True))
    op.add_column("system_config", sa.Column("config_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("system_config", sa.Column("description", sa.String(500), nullable=True))
    op.add_column("system_config", sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("system_config", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    op.add_column("system_config", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    
    # 迁移现有数据
    op.execute("UPDATE system_config SET config_key = key, config_value = value")
    
    # 设置新字段为不可空
    op.alter_column("system_config", "config_key", nullable=False)
    op.alter_column("system_config", "config_value", nullable=False)
    op.alter_column("system_config", "created_at", nullable=False)
    op.alter_column("system_config", "updated_at", nullable=False)
    
    # 删除旧主键和字段
    op.drop_constraint("system_config_pkey", "system_config", type_="primarykey")
    op.drop_column("system_config", "key")
    op.drop_column("system_config", "value")
    
    # 设置新主键
    op.create_primary_key("system_config_pkey", "system_config", ["id"])
    
    # 添加外键
    op.create_foreign_key("fk_system_config_updated_by", "system_config", "user", ["updated_by"], ["id"], ondelete="SET NULL")
    
    # 添加唯一约束
    op.create_index("ix_system_config_config_key", "system_config", ["config_key"], unique=True)


def downgrade() -> None:
    """回滚：删除会议记录模块表并恢复 system_config 原结构"""
    
    # 1. 删除 meeting_minutes 表
    op.drop_index("ix_meeting_minutes_meeting_id", table_name="meeting_minutes")
    op.drop_table("meeting_minutes")
    
    # 2. 删除 meeting_transcript_segment 表
    op.drop_index("ix_meeting_transcript_segment_meeting_id", table_name="meeting_transcript_segment")
    op.drop_index("ix_meeting_transcript_segment_seq", table_name="meeting_transcript_segment")
    op.drop_table("meeting_transcript_segment")
    
    # 3. 删除 meeting_record 表
    op.drop_index("ix_meeting_record_number", table_name="meeting_record")
    op.drop_index("ix_meeting_record_owner_id", table_name="meeting_record")
    op.drop_index("ix_meeting_record_status", table_name="meeting_record")
    op.drop_table("meeting_record")
    
    # 4. 恢复 system_config 表结构
    op.drop_index("ix_system_config_config_key", table_name="system_config")
    op.drop_constraint("fk_system_config_updated_by", "system_config", type_="foreignkey")
    op.drop_constraint("system_config_pkey", "system_config", type_="primarykey")
    
    op.drop_column("system_config", "id")
    op.drop_column("system_config", "config_key")
    op.drop_column("system_config", "config_value")
    op.drop_column("system_config", "description")
    op.drop_column("system_config", "updated_by")
    op.drop_column("system_config", "created_at")
    op.drop_column("system_config", "updated_at")
    
    op.add_column("system_config", sa.Column("key", sa.String(100), nullable=False))
    op.add_column("system_config", sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False))
    
    op.create_primary_key("system_config_pkey", "system_config", ["key"])
