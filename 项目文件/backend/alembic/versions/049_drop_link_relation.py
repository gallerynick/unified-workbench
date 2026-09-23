"""删除 link_relation 通用关联表

Revision ID: 049
Revises: 048
Create Date: 2026-09-24

变更内容：
删除 link_relation 表及其索引 ix_link_relation_source_type_source_id。

该表为项目重做（迁移 034）时引入的通用双向关联表，设计目标是跨模块
松散关联。经全仓扫描确认：
- 零消费者：无任何业务代码引用 LinkRelation 模型或 /link-relations API
- 项目管理内部关联已由标准外键覆盖（project_todo.meeting_id 等）
- 表内 0 行数据，DROP 无数据损失风险

关联清理：
- 已删除 models/link_relation.py、schemas/link_relation.py、
  services/link_relation.py、api/link_relations.py
- 已清理 api/router.py 注册、models/__init__.py 导出
- 已删除前端 api/link-relations.ts、types/link-relation.ts
- 已删除 link_relation说明.md 文档

回滚说明：
downgrade() 可重建表结构与索引，但已写入的关联数据不可恢复（DROP 前
表内为 0 行，实际无数据丢失）。
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "049"
down_revision: str | None = "048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """删除 link_relation 索引与表"""
    op.drop_index("ix_link_relation_source_type_source_id", table_name="link_relation")
    op.drop_table("link_relation")


def downgrade() -> None:
    """回滚：重建 link_relation 表与索引"""
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
    op.create_index(
        "ix_link_relation_source_type_source_id",
        "link_relation",
        ["source_type", "source_id"],
    )
