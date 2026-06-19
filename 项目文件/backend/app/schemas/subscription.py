"""订阅 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


VALID_CYCLES = {"monthly", "yearly"}
VALID_STATUSES = {"active", "cancelled", "paused"}


class SubscriptionCreate(BaseModel):
    name: str
    provider: str
    amount: float
    billing_cycle: str = "monthly"
    next_billing: str | None = None

    @field_validator("billing_cycle")
    @classmethod
    def validate_billing_cycle(cls, v: str) -> str:
        if v not in VALID_CYCLES:
            raise ValueError(f"billing_cycle 必须是 {VALID_CYCLES} 之一")
        return v


class SubscriptionUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    amount: float | None = None
    billing_cycle: str | None = None
    next_billing: str | None = None
    status: str | None = None

    @field_validator("billing_cycle")
    @classmethod
    def validate_billing_cycle(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_CYCLES:
            raise ValueError(f"billing_cycle 必须是 {VALID_CYCLES} 之一")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status 必须是 {VALID_STATUSES} 之一")
        return v


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
