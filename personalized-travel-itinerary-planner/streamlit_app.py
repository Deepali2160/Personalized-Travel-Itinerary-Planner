"""Streamlit version of the Personalized Travel Itinerary Planner.

It reuses the SAME backend code as the FastAPI app (demo mode, budget maths,
AI prompts, PDF export), so both demos behave identically.

Run locally (from the repository root):
    pip install -r requirements.txt
    streamlit run streamlit_app.py

Deploy: see DEPLOY_STREAMLIT.md
"""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import os
import sys
from pathlib import Path

import streamlit as st

# The backend uses flat imports (`import planner`), so put backend/ on the path.
BACKEND_DIR = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

st.set_page_config(page_title="Travel Itinerary Planner", page_icon="🧭", layout="wide")


# ------------------------------------------------------------ secrets -> env
def _load_secrets() -> None:
    """Streamlit Cloud keeps secrets in st.secrets; the backend reads env vars."""
    try:
        for key in ("GROQ_API_KEY", "GROQ_MODEL", "FALLBACK_TO_DEMO", "AI_CALLS_PER_SESSION"):
            if key in st.secrets and not os.getenv(key):
                os.environ[key] = str(st.secrets[key])
    except Exception:  # no secrets file locally: that's fine, demo mode works
        pass


_load_secrets()

import planner  # noqa: E402
from llm import LLMError, ai_configured, api_key_override, get_model  # noqa: E402
from pdf_export import build_pdf  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from schemas import (  # noqa: E402
    SLOTS,
    Itinerary,
    RecommendationRequest,
    RegenerateDayRequest,
    ReplaceActivityRequest,
    TripPreferences,
)

VIBES = ["Beach", "Mountains", "Cultural", "Urban", "Adventure"]
BUDGETS = ["Budget", "Moderate", "Luxury"]
PARTIES = {"Solo": 1, "Couple": 2, "Family": 4, "Friends": 4}
PACES = ["Relaxed", "Moderate", "Fast-Paced"]
INTERESTS = ["Food", "Adventure", "History", "Nature", "Shopping", "Nightlife"]
SLOT_ICONS = {"morning": "🌅", "lunch": "🍽️", "afternoon": "☀️", "evening": "🌙"}

# Protects the owner's free Groq quota on a public link.
MAX_AI_CALLS = int(os.getenv("AI_CALLS_PER_SESSION", "10") or 10)


# ------------------------------------------------------------------ helpers
def run(coro):
    """Run one of the backend's async functions from Streamlit's sync script."""
    return asyncio.run(coro)


def inr(value: int) -> str:
    return f"₹{int(value):,}"


def ss(key, default=None):
    return st.session_state.get(key, default)


def has_own_key() -> bool:
    return bool((ss("user_key") or "").strip())


def ai_available() -> bool:
    # Visitors using their own key are not limited; the owner's key is.
    return ai_configured() and (has_own_key() or ss("ai_calls", 0) < MAX_AI_CALLS)


def use_demo_flag() -> bool:
    """True when this request must use demo mode."""
    return bool(ss("force_demo", False)) or not ai_available()


def count_ai_call() -> None:
    if not use_demo_flag():
        st.session_state["ai_calls"] = ss("ai_calls", 0) + 1


def show_error(err: Exception) -> None:
    if isinstance(err, LLMError):
        st.error(err.message)
    elif isinstance(err, ValidationError):
        first = err.errors()[0]
        where = ".".join(str(p) for p in first.get("loc", []))
        st.error(f"Invalid input ({where}): {first.get('msg')}")
    else:
        st.error(f"Something went wrong: {err}")


def on_party_change() -> None:
    st.session_state["travelers"] = PARTIES[st.session_state["party"]]


def use_destination(name: str) -> None:
    st.session_state["destination"] = name
    st.session_state["notice"] = f"“{name}” was added to the Plan a trip tab."


# A visitor's own key lives only in their session (never in os.environ, never saved).
api_key_override.set((st.session_state.get("user_key") or "").strip())

# --------------------------------------------------------------- state setup
st.session_state.setdefault("ai_calls", 0)
st.session_state.setdefault("party", "Solo")
st.session_state.setdefault("travelers", 1)
st.session_state.setdefault("destination", "")

# ------------------------------------------------------------------ sidebar
with st.sidebar:
    st.title("🧭 Trip Planner")
    st.caption("Day-by-day itineraries with a budget you can trust to add up.")

    st.text_input(
        "Your Groq API key (optional)",
        type="password",
        key="user_key",
        placeholder="gsk_...",
        help="Unlocks AI mode so you can plan ANY destination. Free at console.groq.com/keys. "
        "Kept only in this browser session; never saved or shared.",
    )

    if ai_configured():
        if ai_available():
            st.success(f"AI mode on ({get_model()}): any destination works")
        st.toggle("Use demo mode instead", key="force_demo", help="Demo mode only knows a few sample destinations.")
        if has_own_key():
            st.caption("Using your own key: no request limit.")
        else:
            left = max(MAX_AI_CALLS - ss("ai_calls", 0), 0)
            st.caption(f"Free AI requests left in this session: {left}")
            if left == 0:
                st.info("Free AI limit reached. Paste your own Groq key above to continue, or use demo mode.")
    else:
        st.info(
            "Demo mode: a few built-in sample destinations only. "
            "Paste a free Groq key above to plan any destination."
        )

    st.divider()
    st.caption(
        "All prices are rough estimates per person in INR. Opening hours, distances and "
        "availability are not checked. Verify before you travel."
    )

st.title("Personalized Travel Itinerary Planner")

if ss("notice"):
    st.success(st.session_state.pop("notice"))

tab_plan, tab_ideas = st.tabs(["✈️ Plan a trip", "💡 Get destination ideas"])


# ================================================================ PLAN A TRIP
def build_prefs() -> TripPreferences:
    return TripPreferences(
        vibe=st.session_state["vibe"],
        destination=st.session_state.get("destination") or None,
        start_date=st.session_state["start_date"],
        duration_days=int(st.session_state["duration"]),
        budget=st.session_state["budget"],
        party=st.session_state["party"],
        travelers=int(st.session_state["travelers"]),
        pace=st.session_state["pace"],
        interests=st.session_state.get("interests", []),
        budget_cap_inr=int(st.session_state["cap"]) if st.session_state.get("cap") else None,
        notes=st.session_state.get("notes") or None,
        use_demo=use_demo_flag(),
    )


def swap_activity(day_number: int, slot: str) -> None:
    itin: Itinerary = st.session_state["itinerary"]
    prefs: TripPreferences = st.session_state["prefs"]
    prefs = prefs.model_copy(update={"use_demo": use_demo_flag() if itin.mode == "demo" else False})
    try:
        with st.spinner(f"Finding a different {slot} for day {day_number}..."):
            req = ReplaceActivityRequest(
                preferences=prefs, itinerary=itin.model_copy(deep=True), day_number=day_number, slot=slot
            )
            st.session_state["itinerary"] = run(planner.replace_activity(req))
            if itin.mode == "ai":
                st.session_state["ai_calls"] = ss("ai_calls", 0) + 1
    except Exception as err:  # noqa: BLE001
        show_error(err)
        return
    st.rerun()


def redo_day(day_number: int) -> None:
    itin: Itinerary = st.session_state["itinerary"]
    prefs: TripPreferences = st.session_state["prefs"]
    try:
        with st.spinner(f"Re-planning day {day_number}..."):
            req = RegenerateDayRequest(
                preferences=prefs, itinerary=itin.model_copy(deep=True), day_number=day_number
            )
            st.session_state["itinerary"] = run(planner.regenerate_day(req))
            if itin.mode == "ai":
                st.session_state["ai_calls"] = ss("ai_calls", 0) + 1
    except Exception as err:  # noqa: BLE001
        show_error(err)
        return
    st.rerun()


def render_itinerary(itin: Itinerary, prefs: TripPreferences) -> None:
    st.divider()
    title = f"{itin.destination}, {itin.country}" if itin.country else itin.destination
    st.header(title)
    first, last = itin.days[0].date, itin.days[-1].date
    badge = "AI-generated" if itin.mode == "ai" else "Demo itinerary"
    st.caption(f"{first:%d %b %Y} to {last:%d %b %Y}  ·  {len(itin.days)} days  ·  {badge}")
    st.write(itin.summary)

    for w in itin.warnings:
        st.warning(w)
    st.info(itin.disclaimer)

    # ---- budget
    b = itin.budget
    st.subheader("Estimated budget")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Per person", inr(b.total_per_person_inr))
    c2.metric(f"Group ({b.travelers})", inr(b.total_group_inr))
    c3.metric("Stay (first option)", inr(b.accommodation_inr), help=f"{b.nights} nights")
    c4.metric("Food + activities", inr(b.food_inr + b.activities_inr))
    st.caption(
        f"Food {inr(b.food_inr)}  ·  Activities {inr(b.activities_inr)}  ·  "
        f"Local transport & extras (12% allowance) {inr(b.transport_misc_inr)}  ·  per person"
    )
    if b.cap_inr:
        if b.within_cap:
            st.success(f"Within your budget limit of {inr(b.cap_inr)} for the group.")
        else:
            st.error(
                f"Over your budget limit of {inr(b.cap_inr)} by {inr(b.total_group_inr - b.cap_inr)}. "
                "Try a lower budget tier, fewer days, or swap pricey activities."
            )
    if itin.currency.code != "INR":
        st.caption(
            f"Local currency: {itin.currency.code} (rough rate: 1 {itin.currency.code} ≈ "
            f"₹{itin.currency.approx_inr_per_unit:g}; check a live rate)."
        )

    # ---- stays
    if itin.stays:
        st.subheader("Where to stay (ideas, not bookings)")
        cols = st.columns(len(itin.stays))
        for col, stay in zip(cols, itin.stays):
            with col:
                st.markdown(f"**{stay.name}**")
                st.caption(f"{stay.type}  ·  {stay.area}")
                st.write(f"About {inr(stay.price_per_night_inr)} per person per night")
                if stay.note:
                    st.caption(stay.note)

    # ---- days
    st.subheader("Day by day")
    for day in itin.days:
        label = f"Day {day.day_number} · {day.theme}  ({day.date:%a, %d %b})  ·  {inr(day.day_total_inr)}"
        with st.expander(label, expanded=day.day_number == 1):
            st.caption(f"Area: {day.area_focus}. {day.note}")
            for slot in SLOTS:
                act = getattr(day, slot)
                c_main, c_cost, c_btn = st.columns([6, 2, 1.4])
                with c_main:
                    st.markdown(f"{SLOT_ICONS[slot]} **{slot.capitalize()}: {act.title}**")
                    st.write(act.description)
                    meta = " · ".join(x for x in (act.area, act.duration, act.category) if x)
                    st.caption(meta)
                with c_cost:
                    st.write(inr(act.estimated_cost_inr))
                    if act.estimated_cost_local:
                        st.caption(act.estimated_cost_local)
                with c_btn:
                    if st.button("Swap", key=f"swap_{day.day_number}_{slot}", help="Replace just this activity"):
                        swap_activity(day.day_number, slot)
            if st.button(f"🔄 Re-plan day {day.day_number}", key=f"redo_{day.day_number}"):
                redo_day(day.day_number)

    if itin.tips:
        st.subheader("Tips")
        for tip in itin.tips:
            st.markdown(f"- {tip}")

    # ---- downloads
    st.subheader("Download")
    d1, d2, _ = st.columns([1, 1, 3])
    try:
        pdf_bytes = build_pdf(itin, prefs)
        slug = "".join(ch if ch.isalnum() else "-" for ch in itin.destination.lower()).strip("-") or "trip"
        d1.download_button("📄 PDF", pdf_bytes, file_name=f"itinerary-{slug}.pdf", mime="application/pdf")
    except Exception as err:  # noqa: BLE001
        d1.error(f"PDF failed: {err}")
    d2.download_button(
        "🧾 JSON",
        json.dumps(json.loads(itin.model_dump_json()), indent=2, ensure_ascii=False),
        file_name="itinerary.json",
        mime="application/json",
    )


with tab_plan:
    st.subheader("Tell us about your trip")
    c1, c2 = st.columns(2)
    with c1:
        st.selectbox("Vibe", VIBES, key="vibe")
        st.text_input(
            "Destination (optional)",
            key="destination",
            placeholder="e.g. Goa, Jaipur, Bangkok. Leave blank to let us choose",
        )
        st.date_input("Start date", value=dt.date.today() + dt.timedelta(days=30), min_value=dt.date.today(), key="start_date")
        st.slider("Number of days", 1, 14, 4, key="duration")
        st.multiselect("Interests", INTERESTS, key="interests", max_selections=6)
    with c2:
        st.selectbox("Budget", BUDGETS, index=1, key="budget")
        st.selectbox("Travelling as", list(PARTIES), key="party", on_change=on_party_change)
        st.number_input("Number of travellers", 1, 20, key="travelers")
        st.selectbox("Pace", PACES, index=1, key="pace")
        st.number_input(
            "Total budget limit for the group in ₹ (optional, 0 = none)",
            min_value=0, max_value=100_000_000, value=0, step=5000, key="cap",
        )
    st.text_area("Special requirements (optional)", key="notes", max_chars=600, placeholder="e.g. vegetarian food, travelling with a toddler")

    if st.button("✨ Generate itinerary", type="primary"):
        try:
            if st.session_state.get("cap") and not (1000 <= st.session_state["cap"]):
                raise ValueError("The budget limit must be at least ₹1,000 (or 0 for none).")
            prefs = build_prefs()
            with st.spinner("Planning your trip..."):
                itin = run(planner.generate_itinerary(prefs))
            if itin.mode == "ai":
                count_ai_call()
            st.session_state["itinerary"] = itin
            st.session_state["prefs"] = prefs
        except Exception as err:  # noqa: BLE001
            show_error(err)

    if ss("itinerary") is not None:
        render_itinerary(st.session_state["itinerary"], st.session_state["prefs"])


# ============================================================ DESTINATION IDEAS
with tab_ideas:
    st.subheader("Not sure where to go?")
    st.caption("Uses the vibe, budget, interests, start date and trip length from the Plan a trip tab.")
    if st.button("💡 Suggest 3 destinations"):
        try:
            req = RecommendationRequest(
                vibe=st.session_state.get("vibe", "Beach"),
                budget=st.session_state.get("budget", "Moderate"),
                interests=st.session_state.get("interests", []),
                start_date=st.session_state.get("start_date", dt.date.today() + dt.timedelta(days=30)),
                duration_days=int(st.session_state.get("duration", 4)),
                use_demo=use_demo_flag(),
            )
            with st.spinner("Finding ideas..."):
                recs = run(planner.recommend(req))
            if recs.mode == "ai":
                count_ai_call()
            st.session_state["recs"] = recs
        except Exception as err:  # noqa: BLE001
            show_error(err)

    recs = ss("recs")
    if recs is not None:
        for w in recs.warnings:
            st.warning(w)
        cols = st.columns(len(recs.destinations))
        for i, (col, d) in enumerate(zip(cols, recs.destinations)):
            with col:
                st.markdown(f"### {d.name}")
                st.caption(d.country)
                st.write(d.description)
                for h in d.highlights:
                    st.markdown(f"- {h}")
                st.write(f"**Daily budget:** {inr(d.daily_budget_min_inr)} to {inr(d.daily_budget_max_inr)} per person")
                st.caption(d.season_note)
                if d.best_for:
                    st.caption(d.best_for)
                st.button("Plan this trip", key=f"plan_{i}", on_click=use_destination, args=(d.name,))
        st.info(recs.disclaimer)
