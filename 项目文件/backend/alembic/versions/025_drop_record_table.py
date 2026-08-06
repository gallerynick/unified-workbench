"""删除 record 表，项目功能合并到 project 表

Revision ID: 025
Revises: 024
Create Date: 2026-08-05

变更内容：
1. 删除 project.project_id 列的 FK 约束及列本身（原指向 record.id）
2. project 表新增：project_id(VARCHAR)、description(TEXT)、status、visibility、restricted 列
3. 删除 record 表
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""

    # ── 1. 删除 project 表对 record 的 FK 依赖 ──
    # 尝试查找并删除 FK 约束（不同 PostgreSQL 版本 autogen 的名称可能不同）
    op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'project'::regclass
                  AND confrelid = 'record'::regclass
                  AND contype = 'f'
            ) LOOP
                EXECUTE 'ALTER TABLE project DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
            END LOOP;
        END;
        $$;
    """)

    # 删除旧的 project_id 列（UUID FK）
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS project_id")
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS template_id")

    # ── 2. 为 project 表添加新列（幂等，已存在则跳过）──
    for col_sql in [
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS project_id VARCHAR(50)",
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'",
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private'",
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS restricted_users JSONB",
        "ALTER TABLE project ADD COLUMN IF NOT EXISTS restricted_tags JSONB",
    ]:
        op.execute(col_sql)

    # ── 3. 删除 record 表 ──
    op.drop_table("record")


def downgrade() -> None:
    """回滚迁移"""

    # 恢复 record 表（结构来自 003_p2_tables.py）
    op.create_table(
        "record",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("template.id"), nullable=False),
        sa.Column("template_snapshot", JSONB, nullable=False, comment="创建时的模板schema副本"),
        sa.Column("data", JSONB, nullable=False, server_default="{}", comment="用户填写的字段值"),
        sa.Column("type", sa.String(20), nullable=False, server_default="record", comment="project/record"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft", comment="状态流转"),
        sa.Column("title", sa.String(200), nullable=False, comment="记录标题"),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="private"),
        sa.Column("restricted_users", JSONB, nullable=True),
        sa.Column("restricted_tags", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 删除新增列
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS restricted_tags")
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS restricted_users")
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS visibility")
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS status")
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS description")
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS project_id")

    # 恢复旧的 project_id 列（UUID FK → record.id）
    op.add_column(
        "project",
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("record.id"), nullable=False, comment="所属项目ID"),
    )
