"""Backend tests. Run with:  pytest   (from the backend folder)."""
import asyncio
import copy

import pytest

import llm
import planner
from llm import LLMError
from schemas import SLOTS


# ------------------------------------------------------------------ system
def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_status_reports_demo_mode_without_key(client):
    body = client.get("/api/status").json()
    assert body["mode"] == "demo" and body["ai_configured"] is False


def test_docs_available(client):
    assert client.get("/docs").status_code == 200


# --------------------------------------------------------------- generation
def test_generate_demo_itinerary_structure(client, prefs):
    r = client.post("/api/itinerary/generate", json=prefs)
    assert r.status_code == 200
    itin = r.json()
    assert itin["mode"] == "demo"
    assert itin["destination"] == "Goa"
    assert len(itin["days"]) == 4
    assert itin["days"][0]["date"] == "2026-12-10"
    assert itin["days"][3]["date"] == "2026-12-13"
    for day in itin["days"]:
        for slot in SLOTS:
            assert day[slot]["title"]
        assert day["day_total_inr"] == sum(day[s]["estimated_cost_inr"] for s in SLOTS)
    assert itin["stays"], "should include accommodation ideas"
    assert "estimate" in itin["disclaimer"].lower()
    assert any("No AI key" in w for w in itin["warnings"])


def test_budget_math_adds_up(client, prefs):
    itin = client.post("/api/itinerary/generate", json=prefs).json()
    b = itin["budget"]
    assert b["nights"] == 3
    assert b["total_per_person_inr"] == b["accommodation_inr"] + b["food_inr"] + b["activities_inr"] + b["transport_misc_inr"]
    assert b["total_group_inr"] == b["total_per_person_inr"] * 3
    assert b["accommodation_inr"] == itin["stays"][0]["price_per_night_inr"] * 3


def test_budget_cap_flag(client, prefs):
    prefs["budget_cap_inr"] = 1000
    assert client.post("/api/itinerary/generate", json=prefs).json()["budget"]["within_cap"] is False
    prefs["budget_cap_inr"] = 10_000_000
    assert client.post("/api/itinerary/generate", json=prefs).json()["budget"]["within_cap"] is True


def test_each_day_stays_in_one_area(client, prefs):
    prefs["duration_days"] = 6
    for day in client.post("/api/itinerary/generate", json=prefs).json()["days"]:
        areas = {day[s]["area"] for s in SLOTS if day[s]["category"] != "leisure" or day[s]["area"]}
        assert areas == {day["area_focus"]}


def test_foreign_destination_shows_local_currency(client, prefs):
    prefs.update(vibe="Beach", destination="Phuket")
    itin = client.post("/api/itinerary/generate", json=prefs).json()
    assert itin["currency"]["code"] == "THB"
    paid = [itin["days"][0][s] for s in SLOTS if itin["days"][0][s]["estimated_cost_inr"] > 0]
    assert paid and all(a["estimated_cost_local"].startswith("~THB") for a in paid)


def test_unknown_destination_warns_and_falls_back(client, prefs):
    prefs["destination"] = "Atlantis"
    itin = client.post("/api/itinerary/generate", json=prefs).json()
    assert any("Atlantis" in w for w in itin["warnings"])
    assert itin["destination"] in {"Goa", "Andaman Islands", "Phuket"}


def test_every_vibe_works_for_max_length(client, prefs):
    for vibe in ["Beach", "Mountains", "Cultural", "Urban", "Adventure"]:
        prefs.update(vibe=vibe, destination=None, duration_days=14, budget="Luxury", pace="Relaxed")
        r = client.post("/api/itinerary/generate", json=prefs)
        assert r.status_code == 200, vibe
        assert len(r.json()["days"]) == 14


def test_force_demo_flag(client, prefs):
    prefs["use_demo"] = True
    itin = client.post("/api/itinerary/generate", json=prefs).json()
    assert itin["mode"] == "demo" and not itin["warnings"]


# --------------------------------------------------------------- validation
@pytest.mark.parametrize(
    "change",
    [
        {"duration_days": 0},
        {"duration_days": 15},
        {"vibe": "Space"},
        {"budget": "Free"},
        {"start_date": "not-a-date"},
        {"interests": ["Skydiving"]},
        {"travelers": 0},
    ],
)
def test_invalid_input_returns_friendly_422(client, prefs, change):
    prefs.update(change)
    r = client.post("/api/itinerary/generate", json=prefs)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "validation_error"
    assert r.json()["detail"]["message"]


# ------------------------------------------------------------ partial edits
def _generate(client, prefs, days=5):
    prefs["duration_days"] = days
    return client.post("/api/itinerary/generate", json=prefs).json()


def test_regenerate_day_changes_only_that_day(client, prefs):
    itin = _generate(client, prefs)
    before = copy.deepcopy(itin)
    r = client.post("/api/itinerary/regenerate-day", json={"preferences": prefs, "itinerary": itin, "day_number": 2})
    assert r.status_code == 200
    after = r.json()
    for i in (0, 2, 3, 4):
        assert after["days"][i]["morning"] == before["days"][i]["morning"]
        assert after["days"][i]["evening"] == before["days"][i]["evening"]
    assert after["days"][1]["area_focus"] != before["days"][1]["area_focus"] or \
        after["days"][1]["morning"]["title"] != before["days"][1]["morning"]["title"]
    assert after["days"][1]["day_number"] == 2
    b = after["budget"]
    assert b["activities_inr"] + b["food_inr"] == sum(
        d[s]["estimated_cost_inr"] for d in after["days"] for s in SLOTS
    )


@pytest.mark.parametrize("slot", SLOTS)
def test_replace_activity_changes_only_that_slot(client, prefs, slot):
    itin = _generate(client, prefs)
    before = copy.deepcopy(itin)
    r = client.post(
        "/api/itinerary/replace-activity",
        json={"preferences": prefs, "itinerary": itin, "day_number": 3, "slot": slot},
    )
    assert r.status_code == 200
    after = r.json()
    assert after["days"][2][slot]["title"] != before["days"][2][slot]["title"]
    for other in SLOTS:
        if other != slot:
            assert after["days"][2][other] == before["days"][2][other]
    assert after["days"][0] == before["days"][0]


def test_replace_activity_stays_in_the_same_area(client, prefs):
    prefs["duration_days"] = 6
    itin = client.post("/api/itinerary/generate", json=prefs).json()
    for slot in ("morning", "afternoon", "evening"):
        area = itin["days"][0][slot]["area"]
        out = client.post(
            "/api/itinerary/replace-activity",
            json={"preferences": prefs, "itinerary": itin, "day_number": 1, "slot": slot},
        ).json()
        assert out["days"][0][slot]["area"] == area, slot


def test_regenerate_day_out_of_range(client, prefs):
    itin = _generate(client, prefs, days=3)
    r = client.post("/api/itinerary/regenerate-day", json={"preferences": prefs, "itinerary": itin, "day_number": 9})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "bad_day"


# ---------------------------------------------------------- recommendations
def test_recommendations_return_three_cards(client):
    body = {"vibe": "Mountains", "budget": "Budget", "interests": ["Nature"], "start_date": "2026-10-20"}
    r = client.post("/api/recommendations", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] == "demo" and len(data["destinations"]) == 3
    assert "illustrative" in data["disclaimer"].lower()
    for card in data["destinations"]:
        assert card["description"] and card["highlights"]
        assert 0 < card["daily_budget_min_inr"] < card["daily_budget_max_inr"]


def test_recommendations_depend_on_season(client):
    base = {"vibe": "Adventure", "budget": "Moderate", "interests": []}
    summer = client.post("/api/recommendations", json={**base, "start_date": "2026-06-10"}).json()
    winter = client.post("/api/recommendations", json={**base, "start_date": "2026-12-10"}).json()
    assert summer["destinations"][0]["name"] != winter["destinations"][0]["name"]


# ------------------------------------------------------------------ export
def test_export_pdf(client, prefs):
    itin = _generate(client, prefs, days=3)
    r = client.post("/api/export/pdf", json={"itinerary": itin, "preferences": prefs})
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF") and len(r.content) > 2000
    assert "itinerary-goa.pdf" in r.headers["content-disposition"]


# ---------------------------------------------------- AI error handling
def _enable_ai(monkeypatch):
    monkeypatch.setattr(planner, "ai_configured", lambda: True)


def test_ai_rate_limit_falls_back_to_demo(client, prefs, monkeypatch):
    _enable_ai(monkeypatch)

    async def boom(*a, **k):
        raise LLMError("rate_limited", "The AI rate limit was reached.", 429)

    monkeypatch.setattr(planner, "chat_json", boom)
    itin = client.post("/api/itinerary/generate", json=prefs).json()
    assert itin["mode"] == "demo"
    assert any("rate limit" in w.lower() for w in itin["warnings"])


def test_ai_error_surfaces_when_fallback_disabled(client, prefs, monkeypatch):
    _enable_ai(monkeypatch)
    monkeypatch.setenv("FALLBACK_TO_DEMO", "false")

    async def boom(*a, **k):
        raise LLMError("invalid_api_key", "The AI API key was rejected.", 502)

    monkeypatch.setattr(planner, "chat_json", boom)
    r = client.post("/api/itinerary/generate", json=prefs)
    assert r.status_code == 502
    assert r.json()["detail"]["code"] == "invalid_api_key"


def _fake_ai_itinerary(days):
    act = lambda n: {"title": f"Place {n}", "description": "Nice.", "area": "Old Town", "category": "sightseeing",
                     "duration": "2 hrs", "estimated_cost_inr": "1,200"}
    return {
        "destination": "Lisbon", "country": "Portugal", "summary": "Hilly city.",
        "currency": {"code": "eur", "approx_inr_per_unit": 95},
        "mode": "demo",  # model tries to override; must be ignored
        "days": [{"day_number": i + 1, "theme": "Old Town", "area_focus": "Alfama", "date": "garbage",
                  "morning": act(1), "lunch": {**act(2), "category": "food"}, "afternoon": act(3), "evening": act(4)}
                 for i in range(days)],
        "stays": [{"name": "Guesthouse", "type": "Guesthouse", "area": "Alfama", "price_per_night_inr": 4000, "note": ""}],
        "tips": ["Wear comfy shoes."],
    }


def test_ai_success_path_is_validated_and_recomputed(client, prefs, monkeypatch):
    _enable_ai(monkeypatch)

    async def ok(*a, **k):
        return _fake_ai_itinerary(prefs["duration_days"])

    monkeypatch.setattr(planner, "chat_json", ok)
    itin = client.post("/api/itinerary/generate", json=prefs).json()
    assert itin["mode"] == "ai"
    assert itin["destination"] == "Lisbon"
    assert itin["currency"]["code"] == "EUR"
    assert itin["days"][0]["date"] == "2026-12-10"            # garbage date replaced
    assert itin["days"][0]["morning"]["estimated_cost_inr"] == 1200  # "1,200" coerced
    assert itin["days"][0]["morning"]["estimated_cost_local"].startswith("~EUR")
    assert "AI-generated" in itin["disclaimer"]


def test_ai_wrong_shape_retries_then_falls_back(client, prefs, monkeypatch):
    _enable_ai(monkeypatch)
    calls = {"n": 0}

    async def bad(*a, **k):
        calls["n"] += 1
        return {"days": "nope"}

    monkeypatch.setattr(planner, "chat_json", bad)
    itin = client.post("/api/itinerary/generate", json=prefs).json()
    assert calls["n"] == 2                      # one automatic retry
    assert itin["mode"] == "demo"
    assert any("wrong format" in w for w in itin["warnings"])


def test_ai_too_few_days_is_rejected(client, prefs, monkeypatch):
    _enable_ai(monkeypatch)

    async def short(*a, **k):
        return _fake_ai_itinerary(1)

    monkeypatch.setattr(planner, "chat_json", short)
    assert client.post("/api/itinerary/generate", json=prefs).json()["mode"] == "demo"


def test_ai_mode_partial_edit_errors_are_clear(client, prefs, monkeypatch):
    _enable_ai(monkeypatch)

    async def ok(*a, **k):
        return _fake_ai_itinerary(prefs["duration_days"])

    monkeypatch.setattr(planner, "chat_json", ok)
    itin = client.post("/api/itinerary/generate", json=prefs).json()

    async def limited(*a, **k):
        raise LLMError("rate_limited", "The AI rate limit was reached.", 429)

    monkeypatch.setattr(planner, "chat_json", limited)
    r = client.post("/api/itinerary/regenerate-day", json={"preferences": prefs, "itinerary": itin, "day_number": 1})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "rate_limited"


# ------------------------------------------------------------- llm helpers
def test_parse_json_handles_code_fences():
    assert llm.parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert llm.parse_json('Sure! {"a": {"b": 2}} done') == {"a": {"b": 2}}
    with pytest.raises(ValueError):
        llm.parse_json("no json here")


def test_chat_json_without_key_raises_clear_error():
    with pytest.raises(LLMError) as exc:
        asyncio.run(llm.chat_json("s", "u"))
    assert exc.value.code == "no_api_key"


def test_api_key_override_is_isolated(monkeypatch):
    """A per-request key enables AI mode without touching the environment."""
    import os
    import llm

    assert not llm.ai_configured()
    token = llm.api_key_override.set("gsk_test")
    try:
        assert llm.ai_configured()
        assert llm.get_api_key() == "gsk_test"
        assert os.getenv("GROQ_API_KEY", "") == ""
    finally:
        llm.api_key_override.reset(token)
    assert not llm.ai_configured()
