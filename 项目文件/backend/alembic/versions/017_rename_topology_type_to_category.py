"""rename topology_type to category

Revision ID: 017
Revises: 016
Create Date: 2026-07-02

变更内容：
1. 将 topology 表的 topology_type 列重命名为 category
2. category 为自由文本分类标签（用户自定义），取代原有的 topology_type 枚举

注意：使用 op.alter_column 直接重命名，数据无损（'device'→'device', 'custom'→'custom'）
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """将 topology_type 列重命名为 category"""
    op.alter_column(
        "topology",
        "topology_type",
        new_column_name="category",
        existing_type=None,
        existing_nullable=False,
        existing_server_default=None,
    )


def downgrade() -> None:
    """回滚：将 category 列重命名回 topology_type"""
    op.alter_column(
        "topology",
        "category",
        new_column_name="topology_type",
        existing_type=None,
        existing_nullable=False,
        existing_server_default=None,
    )
