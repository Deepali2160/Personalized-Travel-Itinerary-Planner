"""Shared post-processing for every itinerary (demo or AI).

Whatever produced the itinerary, we recompute dates, per-day totals, local
currency strings and the budget summary here, so the numbers always add up.
"""
from __future__ import annotations

import datetime as dt
from typing import Optional

from schemas import CurrencyInfo, BudgetSummary, Itinerary, SLOTS, TripPreferences

TRANSPORT_MISC_RATE = 0.12  # rough allowance for local transport and small extras

DEMO_DISCLAIMER = (
    "Demo itinerary: built from a small hand-written dataset, not live travel data. "
    "All prices are rough estimates per person in INR. Opening hours, distances, "
    "availability and bookings were NOT checked. Verify everything before you travel."
)
AI_DISCLAIMER = (
    "AI-generated suggestions. All prices are rough estimates per person in INR, "
    "not verified quotes. Opening hours, distances, availability and bookings were "
    "NOT checked. Verify everything before you travel."
)


def local_string(inr: int, currency: CurrencyInfo) -> Optional[str]:
    """e.g. '~THB 1,150' (None for INR or free items)."""
    if currency.code == "INR" or inr <= 0:
        return None
    return f"~{currency.code} {round(inr / currency.approx_inr_per_unit):,}"


def compute_budget(itin: Itinerary, prefs: TripPreferences) -> BudgetSummary:
    nights = max(prefs.duration_days - 1, 0)
    stay_pp = itin.stays[0].price_per_night_inr if itin.stays else 0
    food = activities = 0
    for day in itin.days:
        for slot in SLOTS:
            act = getattr(day, slot)
            if act.category == "food":
                food += act.estimated_cost_inr
            else:
                activities += act.estimated_cost_inr
    misc = round((food + activities) * TRANSPORT_MISC_RATE)
    accommodation = stay_pp * nights
    total_pp = accommodation + food + activities + misc
    group = total_pp * prefs.travelers
    cap = prefs.budget_cap_inr
    return BudgetSummary(
        travelers=prefs.travelers,
        nights=nights,
        accommodation_inr=accommodation,
        food_inr=food,
        activities_inr=activities,
        transport_misc_inr=misc,
        total_per_person_inr=total_pp,
        total_group_inr=group,
        cap_inr=cap,
        within_cap=(group <= cap) if cap else None,
    )


def finalize_itinerary(itin: Itinerary, prefs: TripPreferences, mode: str) -> Itinerary:
    """Fill in dates, totals, local-currency text and the disclaimer."""
    itin.mode = mode  # type: ignore[assignment]
    for index, day in enumerate(itin.days):
        day.day_number = index + 1
        day.date = prefs.start_date + dt.timedelta(days=index)
        total = 0
        for slot in SLOTS:
            act = getattr(day, slot)
            act.estimated_cost_local = local_string(act.estimated_cost_inr, itin.currency)
            total += act.estimated_cost_inr
        day.day_total_inr = total
    itin.budget = compute_budget(itin, prefs)
    itin.disclaimer = DEMO_DISCLAIMER if mode == "demo" else AI_DISCLAIMER
    itin.generated_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    return itin
