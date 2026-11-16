"""Test setup: force demo mode so tests never call a real AI service."""
import os

os.environ["GROQ_API_KEY"] = ""          # no key -> demo mode
os.environ["FALLBACK_TO_DEMO"] = "true"

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def prefs():
    return {
        "vibe": "Beach",
        "destination": "Goa",
        "start_date": "2026-12-10",
        "duration_days": 4,
        "budget": "Moderate",
        "party": "Friends",
        "travelers": 3,
        "pace": "Moderate",
        "interests": ["Food", "Nightlife"],
        "notes": "Vegetarian options please",
        "use_demo": False,
    }
