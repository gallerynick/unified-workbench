"""投票/决策模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class VoteStatus(StrEnum):
    ACTIVE = "active"
    CLOSED = "closed"


class Vote(Base):
    """投票/决策表"""

    __tablename__ = "vote"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    options: Mapped[list] = mapped_column(JSONB, nullable=False)  # ["选项A", "选项B", ...]
    allow_multiple: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[VoteStatus] = mapped_column(Enum(VoteStatus, create_type=False), default=VoteStatus.ACTIVE)
    deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    owner: Mapped[User] = relationship("User", lazy="selectin")


class VoteRecord(Base):
    """投票记录表"""

    __tablename__ = "vote_record"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    vote_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vote.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    selected_options: Mapped[list] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    vote: Mapped[Vote] = relationship("Vote", lazy="selectin")
    user: Mapped[User] = relationship("User", lazy="selectin")
