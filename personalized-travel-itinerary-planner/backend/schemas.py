"""Data models (Pydantic) used by the API.

Pydantic validates every request and every AI response, so the frontend
always receives clean, predictable JSON.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

# ---- Allowed option values (must match frontend/src/constants.js) ----
Vibe = Literal["Beach", "Mountains", "Cultural", "Urban", "Adventure"]
Budget = Literal["Budget", "Moderate", "Luxury"]
Party = Literal["Solo", "Couple", "Family", "Friends"]
Pace = Literal["Relaxed", "Moderate", "Fast-Paced"]
Interest = Literal["Food", "Adventure", "History", "Nature", "Shopping", "Nightlife"]
Slot = Literal["morning", "lunch", "afternoon", "evening"]

CATEGORIES = [
    "food",
    "sightseeing",
    "culture",
    "nature",
    "adventure",
    "shopping",
    "nightlife",
    "leisure",
]
SLOTS = ["morning", "lunch", "afternoon", "evening"]


def _to_int(value: Any) -> int:
    """Turn 1200, 1200.4, '1,200' or 'INR 1200' into an int (0 if impossible)."""
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return max(int(round(value)), 0)
    digits = "".join(ch for ch in str(value) if ch.isdigit() or ch == ".")
    try:
        return max(int(round(float(digits))), 0) if digits else 0
    except ValueError:
        return 0


# ---------------------------------------------------------------- requests
class TripPreferences(BaseModel):
    vibe: Vibe
    destination: Optional[str] = Field(default=None, max_length=80)
    start_date: dt.date
    duration_days: int = Field(ge=1, le=14)
    budget: Budget = "Moderate"
    party: Party = "Solo"
    travelers: int = Field(default=1, ge=1, le=20)
    pace: Pace = "Moderate"
    interests: list[Interest] = Field(default_factory=list, max_length=6)
    budget_cap_inr: Optional[int] = Field(default=None, ge=1000, le=100_000_000)
    notes: Optional[str] = Field(default=None, max_length=600)
    use_demo: bool = False

    @field_validator("destination", "notes", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        if v is None:
            return None
        v = str(v).strip()
        return v or None

    @field_validator("interests")
    @classmethod
    def _dedupe(cls, v):
        return list(dict.fromkeys(v))


class RecommendationRequest(BaseModel):
    vibe: Vibe
    budget: Budget = "Moderate"
    interests: list[Interest] = Field(default_factory=list, max_length=6)
    start_date: dt.date
    duration_days: int = Field(default=5, ge=1, le=14)
    use_demo: bool = False


# ---------------------------------------------------------------- itinerary
class Activity(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    description: str = Field(default="", max_length=700)
    area: str = Field(default="", max_length=90)
    category: str = "sightseeing"
    duration: str = Field(default="", max_length=40)
    estimated_cost_inr: int = 0
    estimated_cost_local: Optional[str] = None

    @field_validator("estimated_cost_inr", mode="before")
    @classmethod
    def _cost(cls, v):
        return _to_int(v)

    @field_validator("category", mode="before")
    @classmethod
    def _category(cls, v):
        v = str(v or "sightseeing").strip().lower()
        return v if v in CATEGORIES else "sightseeing"

    @field_validator("title", "description", "area", "duration", mode="before")
    @classmethod
    def _strip(cls, v):
        return "" if v is None else str(v).strip()


class DayPlan(BaseModel):
    day_number: int = Field(ge=1, le=14)
    date: Optional[dt.date] = None
    theme: str = Field(default="", max_length=140)
    area_focus: str = Field(default="", max_length=140)
    note: str = Field(default="", max_length=400)
    morning: Activity
    lunch: Activity
    afternoon: Activity
    evening: Activity
    day_total_inr: int = 0


class Stay(BaseModel):
    name: str = Field(min_length=1, max_length=140)
    type: str = Field(default="", max_length=60)
    area: str = Field(default="", max_length=90)
    price_per_night_inr: int = 0
    note: str = Field(default="", max_length=400)

    @field_validator("price_per_night_inr", mode="before")
    @classmethod
    def _price(cls, v):
        return _to_int(v)


class CurrencyInfo(BaseModel):
    code: str = Field(default="INR", max_length=6)
    approx_inr_per_unit: float = Field(default=1.0, gt=0, le=100000)

    @field_validator("code", mode="before")
    @classmethod
    def _code(cls, v):
        return (str(v or "INR").strip().upper() or "INR")[:6]

    @field_validator("approx_inr_per_unit", mode="before")
    @classmethod
    def _rate(cls, v):
        try:
            rate = float(v)
            return rate if rate > 0 else 1.0
        except (TypeError, ValueError):
            return 1.0


class BudgetSummary(BaseModel):
    travelers: int = 1
    nights: int = 0
    accommodation_inr: int = 0
    food_inr: int = 0
    activities_inr: int = 0
    transport_misc_inr: int = 0
    total_per_person_inr: int = 0
    total_group_inr: int = 0
    cap_inr: Optional[int] = None
    within_cap: Optional[bool] = None


class Itinerary(BaseModel):
    destination: str = Field(min_length=1, max_length=120)
    country: str = Field(default="", max_length=80)
    summary: str = Field(default="", max_length=900)
    mode: Literal["demo", "ai"] = "demo"
    currency: CurrencyInfo = Field(default_factory=CurrencyInfo)
    days: list[DayPlan]
    stays: list[Stay] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
    budget: BudgetSummary = Field(default_factory=BudgetSummary)
    disclaimer: str = ""
    warnings: list[str] = Field(default_factory=list)
    generated_at: Optional[str] = None


class DestinationCard(BaseModel):
    name: str
    country: str = ""
    description: str = ""
    highlights: list[str] = Field(default_factory=list)
    best_for: str = ""
    season_note: str = ""
    daily_budget_min_inr: int = 0
    daily_budget_max_inr: int = 0

    @field_validator("daily_budget_min_inr", "daily_budget_max_inr", mode="before")
    @classmethod
    def _n(cls, v):
        return _to_int(v)


class RecommendationResponse(BaseModel):
    mode: Literal["demo", "ai"]
    destinations: list[DestinationCard]
    disclaimer: str
    warnings: list[str] = Field(default_factory=list)


# ------------------------------------------------- partial-edit requests
class RegenerateDayRequest(BaseModel):
    preferences: TripPreferences
    itinerary: Itinerary
    day_number: int = Field(ge=1, le=14)


class ReplaceActivityRequest(BaseModel):
    preferences: TripPreferences
    itinerary: Itinerary
    day_number: int = Field(ge=1, le=14)
    slot: Slot


class ExportRequest(BaseModel):
    itinerary: Itinerary
    preferences: Optional[TripPreferences] = None
