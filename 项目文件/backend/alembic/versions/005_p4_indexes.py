"""P4 性能优化 — 数据库索引

Revision ID: 005
Revises: 004
Create Date: 2026-06-19

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建性能优化索引"""

    # content 表索引
    op.create_index("ix_content_owner_id", "content", ["owner_id"])
    op.create_index("ix_content_created_at", "content", ["created_at"])

    # file 表索引
    op.create_index("ix_file_folder_id", "file", ["folder_id"])
    op.create_index("ix_file_owner_id", "file", ["owner_id"])
    op.create_index("ix_file_created_at", "file", ["created_at"])

    # audit_log 表索引
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])

    # record 表索引
    op.create_index("ix_record_owner_id", "record", ["owner_id"])
    op.create_index("ix_record_type", "record", ["type"])
    op.create_index("ix_record_created_at", "record", ["created_at"])

    # secret 表索引
    op.create_index("ix_secret_owner_id", "secret", ["owner_id"])

    # template 表索引
    op.create_index("ix_template_owner_id", "template", ["owner_id"])


def downgrade() -> None:
    """回滚性能优化索引"""

    # 按相反顺序删除索引
    op.drop_index("ix_template_owner_id", table_name="template")
    op.drop_index("ix_secret_owner_id", table_name="secret")
    op.drop_index("ix_record_created_at", table_name="record")
    op.drop_index("ix_record_type", table_name="record")
    op.drop_index("ix_record_owner_id", table_name="record")
    op.drop_index("ix_audit_log_action", table_name="audit_log")
    op.drop_index("ix_audit_log_created_at", table_name="audit_log")
    op.drop_index("ix_audit_log_user_id", table_name="audit_log")
    op.drop_index("ix_file_created_at", table_name="file")
    op.drop_index("ix_file_owner_id", table_name="file")
    op.drop_index("ix_file_folder_id", table_name="file")
    op.drop_index("ix_content_created_at", table_name="content")
    op.drop_index("ix_content_owner_id", table_name="content")
