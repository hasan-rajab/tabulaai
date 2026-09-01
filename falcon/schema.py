from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class TransactionEvent(BaseModel):
    transaction_id: str = Field(min_length=1, max_length=128)
    account_id: str = Field(min_length=1, max_length=128)
    device_id: str = Field(min_length=1, max_length=128)
    amount: float = Field(gt=0, le=1_000_000)
    currency: str = Field(default="BHD", min_length=3, max_length=3)
    merchant_category: str = Field(default="general", min_length=1, max_length=64)
    country: str = Field(default="BH", min_length=2, max_length=3)
    card_present: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("currency", "country")
    @classmethod
    def uppercase_codes(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("merchant_category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return value.strip().lower().replace(" ", "_")

    @field_validator("timestamp")
    @classmethod
    def timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class RiskDecision(BaseModel):
    transaction_id: str
    decision: Literal["approve", "step_up", "manual_review"]
    risk_score: float = Field(ge=0.0, le=1.0)
    supervised_score: float = Field(ge=0.0, le=1.0)
    anomaly_score: float = Field(ge=0.0, le=1.0)
    model_version: int
    model_role: Literal["champion", "challenger"]
    challenger_score: float | None = None
    experiment_bucket: int | None = None
    reasons: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FeedbackEvent(BaseModel):
    transaction_id: str
    is_fraud: bool
    outcome: str | None = Field(default=None, max_length=128)
