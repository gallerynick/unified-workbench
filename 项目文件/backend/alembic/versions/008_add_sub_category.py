"""add sub_category to secret

Revision ID: 008
Revises: 007
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('secret', sa.Column('sub_category', sa.String(100), nullable=False, server_default=''))
    op.create_index('ix_secret_sub_category', 'secret', ['sub_category'])


def downgrade() -> None:
    op.drop_index('ix_secret_sub_category', table_name='secret')
    op.drop_column('secret', 'sub_category')
