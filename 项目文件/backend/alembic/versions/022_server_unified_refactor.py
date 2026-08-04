"""服务器管理架构统一重构：Server(物理机)→System(深度0)→VM(System深度1)

Revision ID: 022
Revises: 021
Create Date: 2026-08-04

变更内容：
1. servers 表：
   - 删除 CheckConstraint ck_servers_server_type
   - 删除 server_type、deploy_status 列
   - 新增 hostname/os/cpu_cores/ram_gb/disk_gb/model/serial_number/tags(JSONB) 列
2. systems 表：
   - 新增 parent_system_id(UUID FK→systems.id ON DELETE CASCADE) + 索引
   - 新增 ip/os_type/os_version/cpu_allocated/ram_allocated/disk_allocated 列
   - 新增 status/environment/tags(JSONB)/notes 列
3. services 表：
   - 新增 protocol/server_default=tcp/status/server_default=running/health_check_url 列
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """执行迁移"""

    # ========== 1. servers 表 ==========
    # 删除旧 CheckConstraint（使用 IF EXISTS 兼容旧数据可能无此约束的情况）
    op.execute("ALTER TABLE servers DROP CONSTRAINT IF EXISTS ck_servers_server_type")
    # 删除旧列
    op.drop_column("servers", "server_type")
    op.drop_column("servers", "deploy_status")
    # 新增列
    op.add_column("servers", sa.Column("hostname", sa.String(200), nullable=True, comment="主机名"))
    op.add_column("servers", sa.Column("os", sa.String(100), nullable=True, comment="操作系统"))
    op.add_column("servers", sa.Column("cpu_cores", sa.Integer(), nullable=True, comment="CPU 核数"))
    op.add_column("servers", sa.Column("ram_gb", sa.Integer(), nullable=True, comment="内存(GB)"))
    op.add_column("servers", sa.Column("disk_gb", sa.Integer(), nullable=True, comment="磁盘(GB)"))
    op.add_column("servers", sa.Column("model", sa.String(200), nullable=True, comment="型号"))
    op.add_column("servers", sa.Column("serial_number", sa.String(100), nullable=True, comment="序列号"))
    op.add_column(
        "servers",
        sa.Column(
            "tags",
            JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
            comment="标签列表",
        ),
    )

    # ========== 2. systems 表 ==========
    op.add_column(
        "systems",
        sa.Column(
            "parent_system_id",
            UUID(as_uuid=True),
            sa.ForeignKey("systems.id", ondelete="CASCADE"),
            nullable=True,
            comment="父系统 ID（非空时为 VM）",
        ),
    )
    op.create_index("ix_systems_parent_system_id", "systems", ["parent_system_id"])
    op.add_column("systems", sa.Column("ip", sa.String(45), nullable=True, comment="IP 地址"))
    op.add_column("systems", sa.Column("os_type", sa.String(50), nullable=True, comment="操作系统类型"))
    op.add_column("systems", sa.Column("os_version", sa.String(100), nullable=True, comment="操作系统版本"))
    op.add_column("systems", sa.Column("cpu_allocated", sa.Integer(), nullable=True, comment="分配 CPU 核数"))
    op.add_column("systems", sa.Column("ram_allocated", sa.Integer(), nullable=True, comment="分配内存(GB)"))
    op.add_column("systems", sa.Column("disk_allocated", sa.Integer(), nullable=True, comment="分配磁盘(GB)"))
    op.add_column(
        "systems",
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="running",
            comment="状态: running/stopped/paused/error",
        ),
    )
    op.add_column(
        "systems",
        sa.Column(
            "environment",
            sa.String(20),
            nullable=False,
            server_default="production",
            comment="环境: production/staging/development/testing",
        ),
    )
    op.add_column(
        "systems",
        sa.Column(
            "tags",
            JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
            comment="标签列表",
        ),
    )
    op.add_column("systems", sa.Column("notes", sa.String(1000), nullable=True, comment="备注"))

    # ========== 3. services 表 ==========
    op.add_column(
        "services",
        sa.Column(
            "protocol",
            sa.String(10),
            nullable=False,
            server_default="tcp",
            comment="协议: tcp/udp/http/https",
        ),
    )
    op.add_column(
        "services",
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="running",
            comment="状态: running/stopped/error",
        ),
    )
    op.add_column(
        "services",
        sa.Column("health_check_url", sa.String(500), nullable=True, comment="健康检查 URL"),
    )


def downgrade() -> None:
    """回滚迁移"""

    # ========== 3. services 表 — 删除新增列 ==========
    op.drop_column("services", "health_check_url")
    op.drop_column("services", "status")
    op.drop_column("services", "protocol")

    # ========== 2. systems 表 — 删除新增列 + 索引 ==========
    op.drop_column("systems", "notes")
    op.drop_column("systems", "tags")
    op.drop_column("systems", "environment")
    op.drop_column("systems", "status")
    op.drop_column("systems", "disk_allocated")
    op.drop_column("systems", "ram_allocated")
    op.drop_column("systems", "cpu_allocated")
    op.drop_column("systems", "os_version")
    op.drop_column("systems", "os_type")
    op.drop_column("systems", "ip")
    op.drop_index("ix_systems_parent_system_id", table_name="systems")
    op.drop_column("systems", "parent_system_id")

    # ========== 1. servers 表 — 删除新增列，恢复旧列 + 约束 ==========
    op.drop_column("servers", "tags")
    op.drop_column("servers", "serial_number")
    op.drop_column("servers", "model")
    op.drop_column("servers", "disk_gb")
    op.drop_column("servers", "ram_gb")
    op.drop_column("servers", "cpu_cores")
    op.drop_column("servers", "os")
    op.drop_column("servers", "hostname")
    # 恢复旧列
    op.add_column(
        "servers",
        sa.Column(
            "deploy_status",
            sa.String(20),
            nullable=False,
            server_default="NORMAL",
            comment="部署状态: NORMAL/PENDING_REDEPLOY/REDEPLOYING",
        ),
    )
    op.add_column(
        "servers",
        sa.Column(
            "server_type",
            sa.String(20),
            nullable=False,
            server_default="SINGLE",
            comment="类型: SINGLE/MULTI",
        ),
    )
    # 恢复 CheckConstraint
    op.create_check_constraint(
        "ck_servers_server_type",
        "servers",
        "server_type IN ('SINGLE', 'MULTI')",
    )
