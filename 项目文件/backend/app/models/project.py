"""项目管理模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.visibility import Visibility

if TYPE_CHECKING:
    from app.models.user import User


class Project(Base):
    """项目表"""

    __tablename__ = "project"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    number: Mapped[str] = mapped_column(
        String(50), nullable=True, default=None, comment="项目编号"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="项目名称")
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None, comment="项目描述"
    )
    content: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default="{}", comment="Tiptap JSON 格式文档内容"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft", comment="状态: draft/ongoing/done/archived"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), nullable=False, comment="创建者ID"
    )
    visibility: Mapped[Visibility] = mapped_column(
        String(20), nullable=False, server_default="private"
    )
    restricted_users: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    restricted_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    member_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    member_permissions: Mapped[dict | None] = mapped_column(JSONB, default=dict, comment="成员权限配置")
    department: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default=None, comment="所属团队/部门"
    )
    language: Mapped[str | None] = mapped_column(
        String(30), nullable=True, default=None, comment="项目语言"
    )
    is_open_source: Mapped[bool] = mapped_column(
        nullable=False, server_default="false", comment="是否开源"
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="待定", comment="项目优先级: 立即/重要/一般/最后/待定"
    )
    project_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True, default=None, comment="项目类型: 六类+其他"
    )
    goals: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None, comment="项目目标"
    )
    requirements: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None, comment="项目需求"
    )
    additional_req: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None, comment="附加需求"
    )
    modules: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None, comment="模块划分"
    )
    related_projects: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None, comment="关联项目"
    )
    dev_process: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None, comment="开发流程"
    )
    repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="开源仓库地址")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
    status_log: Mapped[list | None] = mapped_column(JSONB, default=list, comment="状态变更记录")

    # 关系
    owner: Mapped[User] = relationship("User", lazy="selectin")

    @property
    def owner_name(self) -> str:
        return (
            self.owner.nickname
            if self.owner and self.owner.nickname
            else (self.owner.username if self.owner else "未知")
        )
