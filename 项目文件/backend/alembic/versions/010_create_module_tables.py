"""创建业务模块表：日历、投票、表单、笔记、公告、联系人、任务

Revision ID: 010
Revises: 009
Create Date: 2026-06-21

变更内容：
1. 创建枚举类型：eventrepeat、votestatus、contacttype、taskstatus、taskpriority
2. 新建 calendar_event 日历事件表
3. 新建 vote 投票表 + vote_record 投票记录表
4. 新建 form 表单表 + form_response 表单回复表
5. 新建 note 笔记/知识库表
6. 新建 announcement 公告/通知表
7. 新建 contact 联系人表
8. 新建 task 任务/待办表
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""

    # ========== 0. 创建枚举类型 ==========
    op.execute("CREATE TYPE IF NOT EXISTS eventrepeat AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly')")
    op.execute("CREATE TYPE IF NOT EXISTS votestatus AS ENUM ('active', 'closed')")
    op.execute("CREATE TYPE IF NOT EXISTS contacttype AS ENUM ('customer', 'supplier', 'partner', 'other')")
    op.execute("CREATE TYPE IF NOT EXISTS taskstatus AS ENUM ('todo', 'in_progress', 'done', 'cancelled')")
    op.execute("CREATE TYPE IF NOT EXISTS taskpriority AS ENUM ('low', 'medium', 'high', 'urgent')")

    # ========== 1. calendar_event 日历事件表 ==========
    op.create_table(
        "calendar_event",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("start_time", sa.DateTime, nullable=False),
        sa.Column("end_time", sa.DateTime, nullable=True),
        sa.Column("all_day", sa.Boolean, server_default=sa.text("false")),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("repeat", sa.Enum("none", "daily", "weekly", "monthly", "yearly", name="eventrepeat", create_type=False), server_default=sa.text("'none'::eventrepeat")),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ========== 2. vote 投票表 ==========
    op.create_table(
        "vote",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("options", JSONB, nullable=False),
        sa.Column("allow_multiple", sa.Boolean, server_default=sa.text("false")),
        sa.Column("status", sa.Enum("active", "closed", name="votestatus", create_type=False), server_default=sa.text("'active'::votestatus")),
        sa.Column("deadline", sa.DateTime, nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ========== 3. vote_record 投票记录表 ==========
    op.create_table(
        "vote_record",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vote_id", UUID(as_uuid=True), sa.ForeignKey("vote.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("selected_options", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ========== 4. form 表单/问卷表 ==========
    op.create_table(
        "form",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("fields", JSONB, nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ========== 5. form_response 表单回复表 ==========
    op.create_table(
        "form_response",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("form_id", UUID(as_uuid=True), sa.ForeignKey("form.id"), nullable=False),
        sa.Column("respondent_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
        sa.Column("data", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ========== 6. note 笔记/知识库表 ==========
    op.create_table(
        "note",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("tags", JSONB, nullable=True),
        sa.Column("is_pinned", sa.Boolean, server_default=sa.text("false")),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ========== 7. announcement 公告/通知表 ==========
    op.create_table(
        "announcement",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_pinned", sa.Boolean, server_default=sa.text("false")),
        sa.Column("is_published", sa.Boolean, server_default=sa.text("true")),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ========== 8. contact 联系人表 ==========
    op.create_table(
        "contact",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("company", sa.String(200), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("contact_type", sa.Enum("customer", "supplier", "partner", "other", name="contacttype", create_type=False), server_default=sa.text("'customer'::contacttype")),
        sa.Column("tags", JSONB, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ========== 9. task 任务/待办表 ==========
    op.create_table(
        "task",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.Enum("todo", "in_progress", "done", "cancelled", name="taskstatus", create_type=False), server_default=sa.text("'todo'::taskstatus")),
        sa.Column("priority", sa.Enum("low", "medium", "high", "urgent", name="taskpriority", create_type=False), server_default=sa.text("'medium'::taskpriority")),
        sa.Column("due_date", sa.DateTime, nullable=True),
        sa.Column("assigned_to", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("tags", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    """回滚迁移"""

    # 按照依赖关系逆序删除表
    op.drop_table("task")
    op.drop_table("contact")
    op.drop_table("announcement")
    op.drop_table("note")
    op.drop_table("form_response")
    op.drop_table("form")
    op.drop_table("vote_record")
    op.drop_table("vote")
    op.drop_table("calendar_event")

    # 删除枚举类型
    op.execute("DROP TYPE IF EXISTS taskpriority")
    op.execute("DROP TYPE IF EXISTS taskstatus")
    op.execute("DROP TYPE IF EXISTS contacttype")
    op.execute("DROP TYPE IF EXISTS votestatus")
    op.execute("DROP TYPE IF EXISTS eventrepeat")
