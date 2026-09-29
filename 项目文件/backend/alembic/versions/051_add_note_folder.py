"""新增笔记文件夹表并删除笔记父子嵌套列

Revision ID: 051
Revises: 050
Create Date: 2026-09-29

变更内容：
1. 新增 note_folder 表：知识库的文件夹实体，只允许有简介、不写正文
2. 新增 note_folder_membership 表：笔记 ↔ 文件夹 多对多关联，
   复合主键 (note_id, folder_id)，两端外键 CASCADE 随笔记/文件夹删除
3. 删除 note.parent_id 列及其外键 fk_note_parent：
   笔记父子嵌套已废弃，层级关系改为正文 wikilink（note_link 表）
4. 删除 note.category 列：分类维度已被文件夹取代

数据说明：
处于开发阶段，按「废弃数据全部遗弃删除」原则不做存量回填，
不做兼容层；note_link 与 note_draft 不受影响。

回滚说明：
downgrade() 可重建 note.parent_id（外键 fk_note_parent）与 note.category
两列并删除两张新表，但已创建的文件夹与关联数据不可恢复。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "051"
down_revision: str | None = "050"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """建 note_folder / note_folder_membership，删 note 两列"""

    # 1. note_folder 表
    op.create_table(
        "note_folder",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False, comment="文件夹名"),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="简介：文件夹不写正文，只有简介",
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="显示顺序",
        ),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="归属用户ID",
        ),
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
            comment="可见性",
        ),
        sa.Column(
            "restricted_users",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="[]",
            comment="指定可见用户ID列表",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
    )
    op.create_index("ix_note_folder_owner_id", "note_folder", ["owner_id"])

    # 2. note_folder_membership 表
    op.create_table(
        "note_folder_membership",
        sa.Column("note_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("note_id", "folder_id"),
        sa.ForeignKeyConstraint(
            ["note_id"], ["note.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["folder_id"], ["note_folder.id"], ondelete="CASCADE"
        ),
    )
    # 复合主键左最列是 note_id，folder_id 方向的查询需单独索引
    op.create_index(
        "ix_note_folder_membership_folder_id",
        "note_folder_membership",
        ["folder_id"],
    )

    # 3. 删除 note.parent_id（先删外键再删列）
    op.drop_constraint("fk_note_parent", "note", type_="foreignkey")
    op.drop_column("note", "parent_id")

    # 4. 删除 note.category
    op.drop_column("note", "category")


def downgrade() -> None:
    """恢复 note 两列并删除两张新表"""
    op.create_column(
        "note",
        sa.Column("category", sa.String(100), nullable=True),
    )
    op.create_column(
        "note",
        sa.Column(
            "parent_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
    )
    op.create_foreign_key(
        "fk_note_parent", "note", "note", ["parent_id"], ["id"], ondelete="SET NULL"
    )

    op.drop_index(
        "ix_note_folder_membership_folder_id", table_name="note_folder_membership"
    )
    op.drop_table("note_folder_membership")
    op.drop_index("ix_note_folder_owner_id", table_name="note_folder")
    op.drop_table("note_folder")
