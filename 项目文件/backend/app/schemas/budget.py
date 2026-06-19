"""预算 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BudgetCreate(BaseModel):
    name: str
    category: str
    amount: float
    period: str = "monthly"


class BudgetUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    amount: float | None = None
    spent: float | None = None
    period: str | None = None
    status: str | None = None


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    amount: float
    spent: float
    period: str
    status: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class BudgetListResponse(BaseModel):
    items: list[BudgetResponse]
    total: int
