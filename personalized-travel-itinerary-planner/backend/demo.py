"""Demo-mode engine: builds itineraries and recommendations from the small
hand-written dataset in demo_data/. It needs no API key and no internet.

How it groups travel: every destination is split into 3 areas. Each day sticks
to ONE area, so the morning, lunch, afternoon and evening stops are near each
other. (We do not calculate real distances.)
"""
from __future__ import annotations

import random
import zlib
from typing import Optional

from demo_data import DESTINATIONS
from finalize import finalize_itinerary
from schemas import (
    SLOTS,
    Activity,
    CurrencyInfo,
    DayPlan,
    DestinationCard,
    Itinerary,
    RecommendationRequest,
    RecommendationResponse,
    Stay,
    TripPreferences,
)

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
TIERS = ["Budget", "Moderate", "Luxury"]
TIER_MULT = {"Budget": 0.7, "Moderate": 1.0, "Luxury": 1.8}
TAG_CATEGORY = {
    "Food": "food", "Adventure": "adventure", "History": "culture",
    "Nature": "nature", "Shopping": "shopping", "Nightlife": "nightlife",
    "Leisure": "leisure",
}
INTEREST_TAGS = {"Food", "Adventure", "History", "Nature", "Shopping", "Nightlife"}
RETURN_SUFFIX = " (return visit)"

RECS_DISCLAIMER = (
    "These recommendations are illustrative. They come from a small hand-written "
    "demo dataset, not live prices, weather, availability or reviews. Budget ranges "
    "are rough per-person daily estimates in INR."
)
PACE_NOTES = {
    "Relaxed": "Relaxed pace: start late and keep the afternoon flexible.",
    "Moderate": "Moderate pace: a balanced mix of sightseeing and downtime.",
    "Fast-Paced": "Fast-paced day: start early and keep transfers short.",
}


# ------------------------------------------------------------- lookup
def find_destination(name: Optional[str]) -> Optional[dict]:
    if not name:
        return None
    needle = name.strip().lower()
    if len(needle) < 3:
        return None
    for d in DESTINATIONS:
        if needle == d["name"].lower() or needle == d["id"]:
            return d
    for d in DESTINATIONS:
        hay = d["name"].lower()
        if needle in hay or hay in needle:
            return d
    return None


def interest_tags(dest: dict) -> set[str]:
    tags: set[str] = set()
    for item in dest["attractions"] + dest["evening"]:
        tags.update(t for t in item[2].split(",") if t in INTEREST_TAGS)
    tags.add("Food")  # every destination lists local meals
    return tags


def _season_fit(dest: dict, month: int) -> int:
    if month in dest["best_months"]:
        return 2
    nxt = month % 12 + 1
    prev = (month - 2) % 12 + 1
    if nxt in dest["best_months"] or prev in dest["best_months"]:
        return 1
    return 0


def season_note(dest: dict, month: int) -> str:
    fit = _season_fit(dest, month)
    name = MONTHS[month - 1]
    if fit == 2:
        return f"{name} is generally a good time to visit (illustrative, not a weather forecast)."
    if fit == 1:
        return f"{name} is a shoulder month: conditions can vary, so check the forecast."
    return f"{name} may be off-season here (rain, heat, cold or closures are possible); check locally."


def rank_destinations(vibe: str, budget: str, interests: list[str], month: int) -> list[dict]:
    wanted = set(interests)

    def score(d: dict) -> float:
        gap = abs(TIERS.index(d["sweet_spot"]) - TIERS.index(budget))
        return (
            3 * _season_fit(d, month)
            + 2 * len(wanted & interest_tags(d))
            + {0: 2, 1: 1}.get(gap, 0)
        )

    same = sorted((d for d in DESTINATIONS if d["vibe"] == vibe), key=lambda d: (-score(d), d["name"]))
    others = sorted((d for d in DESTINATIONS if d["vibe"] != vibe), key=lambda d: (-score(d), d["name"]))
    return same + others


# ------------------------------------------------------ recommendations
def recommend_demo(req: RecommendationRequest) -> RecommendationResponse:
    month = req.start_date.month
    ranked = rank_destinations(req.vibe, req.budget, req.interests, month)[:3]
    tier = TIERS.index(req.budget)
    cards = []
    for d in ranked:
        matched = sorted(set(req.interests) & interest_tags(d))
        best_for = (
            f"Matches your interests: {', '.join(matched)}."
            if matched
            else f"A solid all-round {d['vibe'].lower()} choice."
        )
        low, high = d["daily"][tier]
        cards.append(
            DestinationCard(
                name=d["name"],
                country=d["country"],
                description=d["summary"],
                highlights=d["highlights"][:4],
                best_for=best_for,
                season_note=season_note(d, month),
                daily_budget_min_inr=low,
                daily_budget_max_inr=high,
            )
        )
    return RecommendationResponse(mode="demo", destinations=cards, disclaimer=RECS_DISCLAIMER)


# ------------------------------------------------------------ day building
def _base(title: str) -> str:
    return title[: -len(RETURN_SUFFIX)] if title.endswith(RETURN_SUFFIX) else title


def _category(entry: dict) -> str:
    return TAG_CATEGORY.get(entry["tags"][0], "sightseeing") if entry["tags"] else "sightseeing"


def _duration(entry: dict) -> str:
    if entry["kind"] == "food":
        return "approx. 1 hr"
    if entry["kind"] == "evening":
        return "approx. 2-3 hrs"
    tags = entry["tags"]
    if "Adventure" in tags:
        return "approx. 3-4 hrs"
    if "History" in tags or "Leisure" in tags:
        return "approx. 1-2 hrs"
    return "approx. 2 hrs"


def _pools(dest: dict) -> dict[str, list[dict]]:
    attractions = [
        {"title": t, "area": a, "tags": tags.split(","), "cost": c, "desc": d, "kind": "attraction"}
        for t, a, tags, c, d in dest["attractions"]
    ]
    food = [
        {
            "title": f"Lunch: {dish}", "area": a, "tags": ["Food"], "cost": c, "kind": "food",
            "desc": "A suggested local meal. Choose any well-reviewed local restaurant; no specific venue is verified here.",
        }
        for dish, a, c in dest["food"]
    ]
    evening = [
        {"title": t, "area": a, "tags": tags.split(","), "cost": c, "desc": d, "kind": "evening"}
        for t, a, tags, c, d in dest["evening"]
    ]
    return {"attractions": attractions, "food": food, "evening": evening}


def _pick(pool: list[dict], area_idx: int, used: dict[str, int], interests: list[str],
          rng: random.Random, exclude: frozenset = frozenset()) -> dict:
    """Prefer: same area, then least-used, then best interest match."""
    candidates = [p for p in pool if p["title"] not in exclude] or pool
    wanted = set(interests)

    def key(p: dict):
        return (p["area"] != area_idx, used.get(p["title"], 0), -(2 * len(wanted & set(p["tags"])) + rng.random()))

    return min(candidates, key=key)


def _activity(dest: dict, entry: dict, mult: float, reuse: bool) -> Activity:
    return Activity(
        title=entry["title"] + (RETURN_SUFFIX if reuse else ""),
        description=entry["desc"],
        area=dest["areas"][entry["area"]],
        category=_category(entry),
        duration=_duration(entry),
        estimated_cost_inr=int(round(entry["cost"] * mult / 10.0)) * 10,
    )


def _used_counts(days: list[DayPlan], skip_day: Optional[int] = None) -> dict[str, int]:
    used: dict[str, int] = {}
    for day in days:
        if day.day_number == skip_day:
            continue
        for slot in SLOTS:
            t = _base(getattr(day, slot).title)
            used[t] = used.get(t, 0) + 1
    return used


def _build_day(dest: dict, prefs: TripPreferences, day_idx: int, area_idx: int,
               used: dict[str, int], rng: random.Random, exclude: frozenset = frozenset()) -> DayPlan:
    mult = TIER_MULT[prefs.budget]
    pools = _pools(dest)
    taken: set[str] = set()

    def pick(pool_name: str) -> Activity:
        entry = _pick(pools[pool_name], area_idx, used, prefs.interests, rng,
                      exclude=frozenset(set(exclude) | taken))
        taken.add(entry["title"])
        reuse = used.get(entry["title"], 0) > 0
        used[entry["title"]] = used.get(entry["title"], 0) + 1
        return _activity(dest, entry, mult, reuse)

    area_name = dest["areas"][area_idx]
    morning = pick("attractions")
    lunch = pick("food")
    if prefs.pace == "Relaxed" and day_idx % 2 == 1:
        afternoon = Activity(
            title="Free Afternoon to Rest or Explore",
            description="Relaxed pace: unscheduled time to rest, revisit a favourite spot nearby or hop between cafes.",
            area=area_name, category="leisure", duration="flexible",
            estimated_cost_inr=int(round(200 * mult / 10.0)) * 10,
        )
    else:
        afternoon = pick("attractions")
    evening = pick("evening")
    return DayPlan(
        day_number=day_idx + 1,
        theme=f"Exploring {area_name}",
        area_focus=area_name,
        note=PACE_NOTES[prefs.pace],
        morning=morning, lunch=lunch, afternoon=afternoon, evening=evening,
    )


# --------------------------------------------------------------- public API
def build_demo_itinerary(prefs: TripPreferences, rng: Optional[random.Random] = None) -> Itinerary:
    warnings: list[str] = []
    dest = find_destination(prefs.destination)
    if prefs.destination and dest is None:
        dest = rank_destinations(prefs.vibe, prefs.budget, prefs.interests, prefs.start_date.month)[0]
        warnings.append(
            f'Demo mode only has sample data for a few destinations, so "{prefs.destination}" '
            f"was replaced by {dest['name']}. Add a GROQ_API_KEY to plan any destination."
        )
    if dest is None:
        dest = rank_destinations(prefs.vibe, prefs.budget, prefs.interests, prefs.start_date.month)[0]

    rng = rng or random.Random(zlib.crc32(prefs.model_dump_json().encode()))
    used: dict[str, int] = {}
    n_areas = len(dest["areas"])
    days = [_build_day(dest, prefs, i, i % n_areas, used, rng) for i in range(prefs.duration_days)]

    tier = TIERS.index(prefs.budget)
    order = [tier] + [i for i in range(3) if i != tier]
    stays = [
        Stay(
            name=dest["stays"][i][0], type=dest["stays"][i][1], area=dest["areas"][0],
            price_per_night_inr=dest["stays"][i][2],
            note=dest["stays"][i][3] + " Illustrative per-person estimate; not a real booking.",
        )
        for i in order
    ]
    interests = ", ".join(prefs.interests) if prefs.interests else "a mix of highlights"
    summary = (
        f"A {prefs.duration_days}-day, {prefs.pace.lower()}-paced {prefs.vibe.lower()} trip to "
        f"{dest['name']}, {dest['country']}, built around {interests} on a {prefs.budget.lower()} budget. "
        f"{dest['summary']}"
    )
    tips = list(dest["tips"]) + [
        "Prices are rough per-person estimates and change with season and demand.",
        f"Costs are scaled for the {prefs.budget} tier (demo logic: Budget x0.7, Moderate x1, Luxury x1.8).",
    ]
    if prefs.notes:
        tips.append("Demo mode cannot act on free-text notes or special requirements; use AI mode for that.")
    itin = Itinerary(
        destination=dest["name"], country=dest["country"], summary=summary,
        currency=CurrencyInfo(code=dest["currency"], approx_inr_per_unit=dest["inr_per_unit"]),
        days=days, stays=stays, tips=tips, warnings=warnings,
    )
    return finalize_itinerary(itin, prefs, "demo")


def _dest_of(itin: Itinerary) -> dict:
    dest = find_destination(itin.destination)
    if dest is None:
        raise ValueError("Demo data is not available for this destination.")
    return dest


def regenerate_day_demo(itin: Itinerary, prefs: TripPreferences, day_number: int,
                        rng: Optional[random.Random] = None) -> DayPlan:
    dest = _dest_of(itin)
    rng = rng or random.Random()
    current = itin.days[day_number - 1]
    areas = dest["areas"]
    others = [d for d in itin.days if d.day_number != day_number]
    counts = {i: sum(1 for d in others if d.area_focus == areas[i]) for i in range(len(areas))}
    current_idx = areas.index(current.area_focus) if current.area_focus in areas else -1
    options = sorted(range(len(areas)), key=lambda i: (counts[i], rng.random()))
    area_idx = next((i for i in options if i != current_idx), options[0])
    used = _used_counts(itin.days, skip_day=day_number)
    avoid = frozenset(_base(getattr(current, s).title) for s in SLOTS)
    return _build_day(dest, prefs, day_number - 1, area_idx, used, rng, exclude=avoid)


def replace_activity_demo(itin: Itinerary, prefs: TripPreferences, day_number: int, slot: str,
                          rng: Optional[random.Random] = None) -> Activity:
    dest = _dest_of(itin)
    rng = rng or random.Random()
    day = itin.days[day_number - 1]
    current: Activity = getattr(day, slot)
    areas = dest["areas"]
    area_idx = areas.index(current.area) if current.area in areas else 0
    pool_name = {"morning": "attractions", "afternoon": "attractions", "lunch": "food", "evening": "evening"}[slot]
    used = _used_counts(itin.days)
    # Never repeat something already planned THIS day. Stops used on other days are
    # allowed but ranked last, so the replacement stays in the same area when possible.
    same_day = frozenset(_base(getattr(day, s).title) for s in SLOTS)
    entry = _pick(_pools(dest)[pool_name], area_idx, used, prefs.interests, rng, exclude=same_day)
    return _activity(dest, entry, TIER_MULT[prefs.budget], reuse=entry["title"] in used)
