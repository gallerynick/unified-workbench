"""新建服务器管理三张表：servers / systems / services

Revision ID: 020
Revises: 019
Create Date: 2026-08-02

变更内容：
1. 新建 servers 服务器表
   — id/name/purpose/location/ip/port/description/notes
   — status(active/maintenance/retired)、server_type(SINGLE/MULTI, CheckConstraint)、deploy_status(NORMAL/PENDING_REDEPLOY/REDEPLOYING)
   — owner_id → user.id、maintainer_ids JSONB
2. 新建 systems 系统表
   — server_id → servers.id ON DELETE CASCADE
   — maintainer_ids JSONB
3. 新建 services 服务表
   — system_id → systems.id ON DELETE CASCADE
   — target_type/target_name/target_ref
   — maintainer_ids JSONB
4. systems.server_id、services.system_id 索引

说明：server_type 与模型层一致使用 VARCHAR(20) + CheckConstraint 约束
（SINGLE/MULTI），避免创建 PostgreSQL 枚举类型。
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""

    # ========== 1. servers 服务器表 ==========
    op.create_table(
        "servers",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
            comment="服务器 ID",
        ),
        sa.Column("name", sa.String(200), nullable=False, comment="服务器名称"),
        sa.Column("purpose", sa.String(500), nullable=True, comment="用途"),
        sa.Column("location", sa.String(200), nullable=True, comment="位置"),
        sa.Column("ip", sa.String(45), nullable=True, comment="IP 地址（支持 IPv6）"),
        sa.Column("port", sa.Integer(), nullable=True, comment="端口"),
        sa.Column("description", sa.Text(), nullable=True, comment="简介"),
        sa.Column("notes", sa.Text(), nullable=True, comment="备注"),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="active",
            comment="状态: active/maintenance/retired",
        ),
        sa.Column(
            "server_type",
            sa.String(20),
            sa.CheckConstraint(
                "server_type IN ('SINGLE', 'MULTI')",
                name="ck_servers_server_type",
            ),
            nullable=False,
            comment="类型: SINGLE/MULTI",
        ),
        sa.Column(
            "deploy_status",
            sa.String(20),
            nullable=False,
            server_default="NORMAL",
            comment="部署状态: NORMAL/PENDING_REDEPLOY/REDEPLOYING",
        ),
        sa.Column(
            "owner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id"),
            nullable=False,
            comment="所有者 ID",
        ),
        sa.Column(
            "maintainer_ids",
            JSONB,
            nullable=False,
            server_default="[]",
            comment="维护人员 UUID 数组",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
            comment="更新时间",
        ),
    )
    op.create_index("ix_servers_owner_id", "servers", ["owner_id"])

    # ========== 2. systems 系统表 ==========
    op.create_table(
        "systems",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
            comment="系统 ID",
        ),
        sa.Column("name", sa.String(200), nullable=False, comment="系统名称"),
        sa.Column("description", sa.Text(), nullable=True, comment="描述"),
        sa.Column(
            "server_id",
            UUID(as_uuid=True),
            sa.ForeignKey("servers.id", ondelete="CASCADE"),
            nullable=False,
            comment="所属服务器 ID",
        ),
        sa.Column(
            "maintainer_ids",
            JSONB,
            nullable=False,
            server_default="[]",
            comment="维护人员 UUID 数组",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
            comment="更新时间",
        ),
    )
    op.create_index("ix_systems_server_id", "systems", ["server_id"])

    # ========== 3. services 服务表 ==========
    op.create_table(
        "services",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
            comment="服务 ID",
        ),
        sa.Column("name", sa.String(200), nullable=False, comment="服务名称"),
        sa.Column("description", sa.Text(), nullable=True, comment="描述"),
        sa.Column(
            "system_id",
            UUID(as_uuid=True),
            sa.ForeignKey("systems.id", ondelete="CASCADE"),
            nullable=False,
            comment="所属系统 ID",
        ),
        sa.Column(
            "target_type",
            sa.String(20),
            nullable=True,
            comment="服务对象类型: DEVICE/PERSONNEL/ORGANIZATION",
        ),
        sa.Column("target_name", sa.String(200), nullable=True, comment="服务对象名称"),
        sa.Column("target_ref", UUID(as_uuid=True), nullable=True, comment="目标引用键"),
        sa.Column(
            "maintainer_ids",
            JSONB,
            nullable=False,
            server_default="[]",
            comment="维护人员 UUID 数组",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
            comment="更新时间",
        ),
    )
    op.create_index("ix_services_system_id", "services", ["system_id"])


def downgrade() -> None:
    """回滚迁移"""
    op.drop_index("ix_services_system_id", table_name="services")
    op.drop_table("services")
    op.drop_index("ix_systems_server_id", table_name="systems")
    op.drop_table("systems")
    op.drop_index("ix_servers_owner_id", table_name="servers")
    op.drop_table("servers")
