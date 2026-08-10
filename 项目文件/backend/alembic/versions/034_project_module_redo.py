"""项目模块重构 — 重建 project 表并新增 7 张项目子表。

Revision ID: 034
Revises: 033
Create Date: 2026-08-10

变更内容：
1. 删除旧 project 表（CASCADE）并按新规格重建：
   - project_id 列改名为 number（展示用编号，可编辑）
   - 新增 member_permissions JSONB（成员分页权限配置）
   - content/status/member_ids/status_log 均设置服务端默认值
2. 新增 7 张表：
   - project_member   项目成员
   - project_proposal 项目需求/提案
   - project_meeting  项目会议
   - project_change   项目变更
   - project_todo     项目待办
   - project_event    项目动态事件
   - link_relation    通用双向关联表（UUID 关联，不依赖编号）
3. 为 6 张子表的 project_id、project_member.user_id、link_relation 的
   source_type+source_id 建立索引。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "034"
down_revision: str | None = "033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. 删除旧 project 表并重建（无其他表外键引用 project，CASCADE 为安全兜底）
    op.execute("DROP TABLE IF EXISTS project CASCADE")
    op.create_table(
        "project",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(50), nullable=True, comment="项目编号/标识（展示用，可编辑）"),
        sa.Column("title", sa.String(200), nullable=False, comment="项目名称"),
        sa.Column("description", sa.Text(), nullable=True, comment="项目描述"),
        sa.Column("content", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"), comment="Tiptap JSON 格式文档内容"),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'draft'"), comment="状态: draft/ongoing/done/archived"),
        sa.Column("owner_id", sa.Uuid(), nullable=False, comment="创建者ID"),
        sa.Column("member_ids", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"), comment="成员 ID 列表"),
        sa.Column("visibility", sa.String(20), nullable=False, server_default=sa.text("'private'")),
        sa.Column("restricted_users", JSONB, nullable=True),
        sa.Column("restricted_tags", JSONB, nullable=True),
        sa.Column("status_log", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"), comment="状态变更记录"),
        sa.Column(
            "member_permissions",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
            comment="成员分页权限配置: {user_id: {tab: permission}}",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. 项目成员表
    op.create_table(
        "project_member",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role_title", sa.String(100), nullable=True, comment="角色名称"),
        sa.Column("notes", sa.String(500), nullable=True, comment="备注"),
        sa.Column("is_owner", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. 项目需求/提案表
    op.create_table(
        "project_proposal",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(50), nullable=True, comment="提案编号"),
        sa.Column("title", sa.String(200), nullable=False, comment="提案标题"),
        sa.Column("type", sa.String(30), nullable=False, server_default=sa.text("'feature'"), comment="类型: feature/bug/optimize 等"),
        sa.Column("priority", sa.String(10), nullable=False, server_default=sa.text("'P2'"), comment="优先级: P0-P4"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'"), comment="状态: pending/approved/rejected/done"),
        sa.Column("reject_reason", sa.Text(), nullable=True, comment="驳回原因"),
        sa.Column("attachment_links", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"), comment="附件链接列表"),
        sa.Column("creator_id", sa.Uuid(), nullable=False, comment="创建者ID"),
        sa.Column("assignee_id", sa.Uuid(), nullable=True, comment="负责人ID"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["creator_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["assignee_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 4. 项目会议表
    op.create_table(
        "project_meeting",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(50), nullable=True, comment="会议编号"),
        sa.Column("type", sa.String(50), nullable=True, comment="会议类型"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True, comment="会议开始时间"),
        sa.Column("speaker", sa.String(100), nullable=True, comment="主讲人"),
        sa.Column("participants", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"), comment="参会人列表"),
        sa.Column("content", sa.Text(), nullable=True, comment="会议内容"),
        sa.Column("notes", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"), comment="会议纪要条目"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 5. 项目变更表
    op.create_table(
        "project_change",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(50), nullable=True, comment="变更编号"),
        sa.Column("title", sa.String(200), nullable=False, comment="变更标题"),
        sa.Column("date", sa.DateTime(timezone=True), nullable=True, comment="变更日期"),
        sa.Column("category_major", sa.String(30), nullable=True, comment="一级分类"),
        sa.Column("category_minor", sa.String(50), nullable=True, comment="二级分类"),
        sa.Column("category_detail", sa.String(200), nullable=True, comment="细分分类"),
        sa.Column("content", sa.Text(), nullable=True, comment="变更内容"),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'"), comment="状态: pending/approved/rejected"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 6. 项目待办表
    op.create_table(
        "project_todo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(50), nullable=True, comment="待办编号"),
        sa.Column("title", sa.String(200), nullable=False, comment="待办标题"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(10), nullable=False, server_default=sa.text("'P2'"), comment="优先级: P0-P4"),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'"), comment="状态: pending/in_progress/done/cancelled"),
        sa.Column("assignee_id", sa.Uuid(), nullable=True, comment="负责人ID"),
        sa.Column("creator_id", sa.Uuid(), nullable=False, comment="创建者ID"),
        sa.Column("proposal_id", sa.Uuid(), nullable=True, comment="关联提案ID"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True, comment="截止时间"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignee_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["creator_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["proposal_id"], ["project_proposal.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 7. 项目动态事件表
    op.create_table(
        "project_event",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(50), nullable=True, comment="事件编号"),
        sa.Column("event_type", sa.String(30), nullable=True, comment="事件类型"),
        sa.Column("title", sa.String(200), nullable=False, comment="事件标题"),
        sa.Column("details", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"), comment="事件详情"),
        sa.Column("operator_id", sa.Uuid(), nullable=True, comment="操作人ID"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["operator_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 8. 通用双向关联表（UUID 关联，不依赖编号）
    op.create_table(
        "link_relation",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False, comment="源对象类型"),
        sa.Column("source_id", sa.Uuid(), nullable=False, comment="源对象ID"),
        sa.Column("target_type", sa.String(30), nullable=False, comment="目标对象类型"),
        sa.Column("target_id", sa.Uuid(), nullable=False, comment="目标对象ID"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. 索引
    op.create_index("ix_project_member_project_id", "project_member", ["project_id"])
    op.create_index("ix_project_member_user_id", "project_member", ["user_id"])
    op.create_index("ix_project_proposal_project_id", "project_proposal", ["project_id"])
    op.create_index("ix_project_meeting_project_id", "project_meeting", ["project_id"])
    op.create_index("ix_project_change_project_id", "project_change", ["project_id"])
    op.create_index("ix_project_todo_project_id", "project_todo", ["project_id"])
    op.create_index("ix_project_event_project_id", "project_event", ["project_id"])
    op.create_index(
        "ix_link_relation_source_type_source_id",
        "link_relation",
        ["source_type", "source_id"],
    )


def downgrade() -> None:
    # 按依赖顺序删除子表：project_todo 先于 project_proposal，全部先于 project
    op.drop_table("project_todo")
    op.drop_table("project_event")
    op.drop_table("project_change")
    op.drop_table("project_meeting")
    op.drop_table("project_proposal")
    op.drop_table("project_member")
    op.drop_table("link_relation")
    op.drop_table("project")
