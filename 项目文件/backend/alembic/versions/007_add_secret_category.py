"""add secret_category table and category_id to secret

Revision ID: 007
Revises: 006
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create secret_category table
    op.create_table(
        'secret_category',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.String(500), server_default=''),
        sa.Column('owner_id', UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_secret_category_owner_id', 'secret_category', ['owner_id'])

    # Add category_id column to secret table
    op.add_column('secret', sa.Column('category_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_secret_category_id', 'secret', 'secret_category', ['category_id'], ['id'])
    op.create_index('ix_secret_category_id', 'secret', ['category_id'])


def downgrade() -> None:
    op.drop_index('ix_secret_category_id', table_name='secret')
    op.drop_constraint('fk_secret_category_id', 'secret', type_='foreignkey')
    op.drop_column('secret', 'category_id')
    op.drop_index('ix_secret_category_owner_id', table_name='secret_category')
    op.drop_table('secret_category')
