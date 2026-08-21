"""项目提案评论"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project_proposal import ProjectProposal
    from app.models.user import User


class ProjectProposalComment(Base):
    """项目提案评论表"""

    __tablename__ = "project_proposal_comment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_proposal.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属提案ID",
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        comment="创建者ID",
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="评论内容")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_project_proposal_comment_proposal_id", "proposal_id"),
    )

    # 关系
    proposal: Mapped[ProjectProposal] = relationship("ProjectProposal", lazy="selectin")
    creator: Mapped[User] = relationship("User", foreign_keys=[creator_id], lazy="selectin")