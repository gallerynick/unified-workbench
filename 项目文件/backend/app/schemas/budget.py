"""预算 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.budget import BudgetPeriod, BudgetStatus


VALID_PERIODS = {"monthly", "quarterly", "yearly"}
VALID_STATUSES = {"active", "exceeded", "completed"}


class BudgetCreate(BaseModel):
    name: str
    category: str
    amount: float
    period: BudgetPeriod = BudgetPeriod.MONTHLY

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        if v not in VALID_PERIODS:
            raise ValueError(f"period 必须是 {VALID_PERIODS} 之一")
        return v


class BudgetUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    amount: float | None = None
    spent: float | None = None
    period: BudgetPeriod | None = None
    status: BudgetStatus | None = None

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_PERIODS:
            raise ValueError(f"period 必须是 {VALID_PERIODS} 之一")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status 必须是 {VALID_STATUSES} 之一")
        return v


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    amount: float
    spent: float
    period: BudgetPeriod
    status: BudgetStatus
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class BudgetListResponse(BaseModel):
    items: list[BudgetResponse]
    total: int
