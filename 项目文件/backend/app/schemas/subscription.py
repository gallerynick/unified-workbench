"""订阅 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SubscriptionCreate(BaseModel):
    name: str
    provider: str
    amount: float
    billing_cycle: str = "monthly"
    next_billing: str | None = None


class SubscriptionUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    amount: float | None = None
    billing_cycle: str | None = None
    next_billing: str | None = None
    status: str | None = None


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    provider: str
    amount: float
    billing_cycle: str
    next_billing: datetime | None
    status: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class SubscriptionListResponse(BaseModel):
    items: list[SubscriptionResponse]
    total: int
