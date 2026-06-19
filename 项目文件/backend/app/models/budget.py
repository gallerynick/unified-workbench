"""预算模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class BudgetPeriod(StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class BudgetStatus(StrEnum):
    ACTIVE = "active"
    EXCEEDED = "exceeded"
    COMPLETED = "completed"


class Budget(Base):
    """预算表"""

    __tablename__ = "budget"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    spent: Mapped[float] = mapped_column(Float, default=0)
    period: Mapped[BudgetPeriod] = mapped_column(
        Enum(BudgetPeriod, create_type=False), default=BudgetPeriod.MONTHLY
    )
    status: Mapped[BudgetStatus] = mapped_column(
        Enum(BudgetStatus, create_type=False), default=BudgetStatus.ACTIVE
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped[User] = relationship("User", lazy="selectin")
