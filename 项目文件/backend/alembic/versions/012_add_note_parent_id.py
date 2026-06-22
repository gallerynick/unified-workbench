"""为 note 表添加 parent_id 字段支持树形层级

Revision ID: 012
Revises: 011
Create Date: 2026-06-22

变更内容：
1. 向 note 表添加 parent_id 列（UUID，可为 NULL，根节点为 NULL）
2. 添加自引用外键约束 fk_note_parent，ondelete="SET NULL"
   删除父笔记时，子笔记自动变为根节点
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("note", sa.Column("parent_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_note_parent",
        "note",
        "note",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
        use_alter=True,
    )


def downgrade() -> None:
    op.drop_constraint("fk_note_parent", "note", type_="foreignkey")
    op.drop_column("note", "parent_id")
