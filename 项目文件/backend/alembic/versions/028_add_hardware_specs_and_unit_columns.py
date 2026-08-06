"""服务器表硬件规格与容量单位列

Revision ID: 028
Revises: 027
Create Date: 2026-08-06
"""

from collections.abc import Sequence

from alembic import op

revision: str = "028"
down_revision: str | None = "027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE servers ADD COLUMN IF NOT EXISTS hardware_specs JSONB DEFAULT '[]'::jsonb NOT NULL"
    )
    op.execute("ALTER TABLE servers RENAME COLUMN ram_gb TO ram_capacity")
    op.execute(
        "ALTER TABLE servers ADD COLUMN IF NOT EXISTS ram_unit VARCHAR(10) NOT NULL DEFAULT 'GB'"
    )
    op.execute("ALTER TABLE servers RENAME COLUMN disk_gb TO disk_capacity")
    op.execute(
        "ALTER TABLE servers ADD COLUMN IF NOT EXISTS disk_unit VARCHAR(10) NOT NULL DEFAULT 'GB'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE servers RENAME COLUMN ram_capacity TO ram_gb")
    op.execute("ALTER TABLE servers RENAME COLUMN disk_capacity TO disk_gb")
    op.execute("ALTER TABLE servers DROP COLUMN IF EXISTS disk_unit")
    op.execute("ALTER TABLE servers DROP COLUMN IF EXISTS ram_unit")
    op.execute("ALTER TABLE servers DROP COLUMN IF EXISTS hardware_specs")
