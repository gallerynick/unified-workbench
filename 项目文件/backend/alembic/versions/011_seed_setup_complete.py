"""为已有部署种子 setup_complete 配置行

Revision ID: 011
Revises: 010
Create Date: 2026-06-22

变更内容：
1. 仅当已有用户记录时，向 system_config 表插入 setup_complete 行
   确保已通过欢迎页面的老用户不会被再次引导
   全新部署（无用户记录）不插入，让首次管理员正常进入欢迎页
"""

from typing import Sequence, Union

from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO system_config (key, value)
        SELECT 'setup_complete', '{"complete": true}'::jsonb
        WHERE EXISTS (SELECT 1 FROM "user")
        ON CONFLICT (key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM system_config WHERE key = 'setup_complete'
        """
    )