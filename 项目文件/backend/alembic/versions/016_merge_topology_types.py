"""merge topology types: remove 'device' (old), rename 'network' → 'device'

Revision ID: 016
Revises: 015
Create Date: 2026-07-02

变更内容：
1. 将 topology 表中所有 topology_type = 'network' 的记录改为 'device'
2. 删除旧的 topology_type = 'device'（emoji 图标）类型定义，统一为 SVG 图标的 device 类型
3. 最终只保留 device 和 custom 两种拓扑类型
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """将 network 类型的拓扑迁移为 device 类型"""
    op.execute(
        text("UPDATE topology SET topology_type = 'device' WHERE topology_type = 'network'")
    )


def downgrade() -> None:
    """回滚：无法精确区分哪些 device 原本是 network，不做回滚"""
    pass
