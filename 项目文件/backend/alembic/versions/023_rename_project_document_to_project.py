"""ProjectDocument 表重命名为 Project

Revision ID: 023
Revises: 022
Create Date: 2026-08-04

变更内容：
1. 将 project_document 表重命名为 project，与模型类 Project 对应
   （数据保留，仅 ALTER TABLE RENAME）
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""
    op.execute("ALTER TABLE IF EXISTS project_document RENAME TO project")


def downgrade() -> None:
    """回滚迁移"""
    op.execute("ALTER TABLE IF EXISTS project RENAME TO project_document")
