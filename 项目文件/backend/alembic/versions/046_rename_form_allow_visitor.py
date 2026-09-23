"""form.allow_anonymous 物理列名改名为 allow_visitor

Revision ID: 046
Revises: 045
Create Date: 2026-09-09

变更内容：
1. form 表物理列 allow_anonymous 改名为 allow_visitor，与代码层命名口径统一
   （「匿名」口径已全栈下线，统一为「访客」）
2. 列类型（BOOLEAN）、可空性、默认值语义均不变，纯改名，不丢数据

说明：
- PostgreSQL 的 ALTER TABLE ... RENAME COLUMN 会自动同步更新依赖该列的
  约束、索引、视图与触发器；本列上无索引/约束（仅 form_pkey 落在 id 上），
  改名无连带影响
- 部署侧在 backend/Dockerfile CMD 中以幂等 inline SQL 执行同等改名，
  因为当前部署采用 create_all 优先（create_all 只建缺失的表，不改已有列），
  且线上库未初始化 alembic_version，不会自动执行本迁移
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "046"
down_revision: str | None = "045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """物理列改名：allow_anonymous -> allow_visitor"""
    op.alter_column(
        "form",
        "allow_anonymous",
        new_column_name="allow_visitor",
    )


def downgrade() -> None:
    """回滚：改回原列名"""
    op.alter_column(
        "form",
        "allow_visitor",
        new_column_name="allow_anonymous",
    )
