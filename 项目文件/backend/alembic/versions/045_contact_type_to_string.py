"""contact.contact_type 由 PostgreSQL 枚举改为 VARCHAR(100)

Revision ID: 045
Revises: 044
Create Date: 2026-09-08

变更内容：
1. contact.contact_type 列类型由 ENUM('customer','supplier','partner','other')
   改为 VARCHAR(100)，支持自由填写联系人类型（预设之外的自定义值）
2. 删除不再被任何列引用的 PostgreSQL 枚举类型 contacttype
3. 列仍为 NOT NULL，默认值由 'customer'::contacttype 改为文本 'customer'

说明：
- 使用 ALTER COLUMN ... TYPE ... USING contact_type::text 保留既有数据，
  原有 customer / supplier / partner / other 值原样转为文本，不丢数据
- 部署侧同步在 backend/Dockerfile 启动时以 inline SQL 执行同等变更（幂等），
  因为当前部署采用 create_all 优先而非 alembic upgrade head
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "045"
down_revision: str | None = "044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 旧枚举定义（create_type=False：类型生命周期由迁移文件控制，不重复建类型）
_CONTACTTYPE_OLD = sa.Enum(
    "customer", "supplier", "partner", "other",
    name="contacttype", create_type=False,
)


def upgrade() -> None:
    """contact_type 枚举列改为 VARCHAR(100)，保留既有值"""
    op.alter_column(
        "contact",
        "contact_type",
        existing_type=_CONTACTTYPE_OLD,
        type_=sa.String(100),
        existing_nullable=False,
        existing_server_default=sa.text("'customer'::contacttype"),
        server_default="customer",
        postgresql_using="contact_type::text",
    )
    # 枚举类型不再被引用，删除以避免遗留无用类型
    op.execute("DROP TYPE IF EXISTS contacttype")


def downgrade() -> None:
    """回滚：重建枚举类型并把列改回 ENUM，无法映射的自由文本归入 'other'"""
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE contacttype AS ENUM ('customer', 'supplier', 'partner', 'other'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )
    # 预设之外的自定义类型无法还原为枚举值，统一归入 'other'
    op.execute(
        "UPDATE contact SET contact_type = 'other' "
        "WHERE contact_type NOT IN ('customer', 'supplier', 'partner', 'other')"
    )
    op.alter_column(
        "contact",
        "contact_type",
        existing_type=sa.String(100),
        type_=sa.Enum(
            "customer", "supplier", "partner", "other",
            name="contacttype", create_type=False,
        ),
        existing_nullable=False,
        existing_server_default="customer",
        server_default=sa.text("'customer'::contacttype"),
        postgresql_using="contact_type::contacttype",
    )
