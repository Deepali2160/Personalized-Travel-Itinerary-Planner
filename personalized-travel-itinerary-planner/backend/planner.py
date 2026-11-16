"""Business logic: decides between AI mode and demo mode and validates results.

Rules
- generate + recommendations: if the AI fails, fall back to demo mode (when
  FALLBACK_TO_DEMO is true) and say why in `warnings`.
- single-day / single-activity edits: use the same mode the itinerary was
  made in. If the AI fails there we return a clear error instead of swapping
  in unrelated demo content.
"""
from __future__ import annotations

import os
from typing import Any

from pydantic import ValidationError

import demo
from finalize import finalize_itinerary
from llm import (
    LLMError,
    activity_prompt,
    ai_configured,
    chat_json,
    day_prompt,
    itinerary_prompt,
    recommendation_prompt,
)
from schemas import (
    SLOTS,
    Activity,
    DayPlan,
    DestinationCard,
    Itinerary,
    RecommendationRequest,
    RecommendationResponse,
    RegenerateDayRequest,
    ReplaceActivityRequest,
    TripPreferences,
)

# Keys the AI must not control; we compute them ourselves.
_ITINERARY_DROP = ("mode", "budget", "disclaimer", "warnings", "generated_at")
_DAY_DROP = ("date", "day_total_inr")
_ACT_DROP = ("estimated_cost_local",)


def fallback_enabled() -> bool:
    return os.getenv("FALLBACK_TO_DEMO", "true").strip().lower() not in ("0", "false", "no")


def _clean_activity(raw: Any) -> Any:
    if isinstance(raw, dict):
        for key in _ACT_DROP:
            raw.pop(key, None)
    return raw


def _clean_day(raw: Any) -> Any:
    if isinstance(raw, dict):
        for key in _DAY_DROP:
            raw.pop(key, None)
        for slot in SLOTS:
            _clean_activity(raw.get(slot))
    return raw


def _parse_itinerary(raw: dict, prefs: TripPreferences) -> Itinerary:
    days = raw.get("days")
    if not isinstance(days, list) or len(days) < prefs.duration_days:
        raise ValueError(f"Expected {prefs.duration_days} days but got {len(days) if isinstance(days, list) else 0}.")
    raw["days"] = [_clean_day(d) for d in days[: prefs.duration_days]]
    for key in _ITINERARY_DROP:
        raw.pop(key, None)
    if not isinstance(raw.get("stays"), list):
        raw["stays"] = []
    if not isinstance(raw.get("tips"), list):
        raw["tips"] = []
    raw["tips"] = [str(t) for t in raw["tips"]][:8]
    return Itinerary.model_validate(raw)


def _api_status_for_validation() -> LLMError:
    return LLMError("invalid_response", "The AI returned an itinerary in the wrong format. Please try again.", 502)


# ------------------------------------------------------------- generate
async def generate_itinerary(prefs: TripPreferences) -> Itinerary:
    warnings: list[str] = []
    if not prefs.use_demo:
        if not ai_configured():
            warnings.append("No AI key is configured, so this is a demo itinerary. Add GROQ_API_KEY to use AI mode.")
        else:
            try:
                itin = await _generate_with_ai(prefs)
                return itin
            except LLMError as err:
                if not fallback_enabled():
                    raise
                warnings.append(f"{err.message} Showing a demo itinerary instead.")
    itin = demo.build_demo_itinerary(prefs)
    itin.warnings = warnings + itin.warnings
    return itin


async def _generate_with_ai(prefs: TripPreferences) -> Itinerary:
    system, user = itinerary_prompt(prefs)
    max_tokens = min(1500 + 450 * prefs.duration_days, 8000)
    for _ in range(2):
        raw = await chat_json(system, user, max_tokens=max_tokens)
        try:
            itin = _parse_itinerary(raw, prefs)
        except (ValidationError, ValueError, TypeError):
            continue
        return finalize_itinerary(itin, prefs, "ai")
    raise _api_status_for_validation()


# ------------------------------------------------------- partial edits
def _day_index(itin: Itinerary, day_number: int) -> int:
    if day_number < 1 or day_number > len(itin.days):
        raise LLMError("bad_day", f"Day {day_number} does not exist in this itinerary.", 422)
    return day_number - 1


def _titles(days: list[DayPlan], skip: int | None = None) -> list[str]:
    return [getattr(d, s).title for d in days if d.day_number != skip for s in SLOTS]


async def regenerate_day(req: RegenerateDayRequest) -> Itinerary:
    itin = req.itinerary
    idx = _day_index(itin, req.day_number)
    prefs = req.preferences

    if itin.mode == "demo":
        try:
            new_day = demo.regenerate_day_demo(itin, prefs, req.day_number)
        except ValueError as err:
            raise LLMError("demo_unavailable", str(err), 422)
    else:
        current = [getattr(itin.days[idx], s).title for s in SLOTS]
        system, user = day_prompt(prefs, itin.destination, req.day_number, current, _titles(itin.days, req.day_number))
        raw = await chat_json(system, user, max_tokens=1800)
        try:
            raw["day_number"] = req.day_number
            new_day = DayPlan.model_validate(_clean_day(raw))
        except ValidationError:
            raise _api_status_for_validation()

    itin.days[idx] = new_day
    return finalize_itinerary(itin, prefs, itin.mode)


async def replace_activity(req: ReplaceActivityRequest) -> Itinerary:
    itin = req.itinerary
    idx = _day_index(itin, req.day_number)
    prefs = req.preferences
    day = itin.days[idx]
    current: Activity = getattr(day, req.slot)

    if itin.mode == "demo":
        try:
            new_act = demo.replace_activity_demo(itin, prefs, req.day_number, req.slot)
        except ValueError as err:
            raise LLMError("demo_unavailable", str(err), 422)
    else:
        system, user = activity_prompt(
            prefs, itin.destination, req.day_number, req.slot, current.area, current.title, _titles(itin.days)
        )
        raw = await chat_json(system, user, max_tokens=700)
        try:
            new_act = Activity.model_validate(_clean_activity(raw))
        except ValidationError:
            raise _api_status_for_validation()

    setattr(day, req.slot, new_act)
    return finalize_itinerary(itin, prefs, itin.mode)


# ------------------------------------------------------ recommendations
async def recommend(req: RecommendationRequest) -> RecommendationResponse:
    warnings: list[str] = []
    if not req.use_demo:
        if not ai_configured():
            warnings.append("No AI key is configured, so these are demo recommendations.")
        else:
            try:
                return await _recommend_with_ai(req)
            except LLMError as err:
                if not fallback_enabled():
                    raise
                warnings.append(f"{err.message} Showing demo recommendations instead.")
    result = demo.recommend_demo(req)
    result.warnings = warnings
    return result


async def _recommend_with_ai(req: RecommendationRequest) -> RecommendationResponse:
    system, user = recommendation_prompt(req.vibe, req.budget, req.interests, req.start_date.isoformat(), req.duration_days)
    for _ in range(2):
        raw = await chat_json(system, user, max_tokens=1500)
        try:
            items = raw.get("destinations")
            if not isinstance(items, list):
                raise ValueError("missing destinations")
            cards = [DestinationCard.model_validate(item) for item in items[:3]]
            if len(cards) < 3:
                raise ValueError("need three destinations")
        except (ValidationError, ValueError, TypeError):
            continue
        return RecommendationResponse(
            mode="ai",
            destinations=cards,
            disclaimer=(
                "AI-generated suggestions. Budget ranges are rough per-person daily estimates in INR "
                "and the season notes are not weather forecasts. Verify prices and conditions before booking."
            ),
        )
    raise _api_status_for_validation()
