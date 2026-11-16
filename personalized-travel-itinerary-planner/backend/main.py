"""FastAPI app: Personalized Travel Itinerary Planner.

Run (from the backend folder, with the virtual environment active):
    uvicorn main:app --reload --port 8000
Then open http://localhost:8000/docs
"""
from __future__ import annotations

import os
import re

from dotenv import load_dotenv

load_dotenv()  # reads backend/.env if it exists (never committed to Git)

from fastapi import FastAPI, Request, Response  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

import planner  # noqa: E402
from llm import LLMError, ai_configured, get_model  # noqa: E402
from pdf_export import build_pdf  # noqa: E402
from schemas import (  # noqa: E402
    ExportRequest,
    Itinerary,
    RecommendationRequest,
    RecommendationResponse,
    RegenerateDayRequest,
    ReplaceActivityRequest,
    TripPreferences,
)

VERSION = "1.0.0"

app = FastAPI(
    title="Personalized Travel Itinerary Planner API",
    version=VERSION,
    description=(
        "Generates day-by-day itineraries. Uses Groq when GROQ_API_KEY is set, "
        "otherwise a built-in demo mode. All prices are rough estimates."
    ),
)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------ error shape
@app.exception_handler(LLMError)
async def llm_error_handler(_: Request, err: LLMError):
    return JSONResponse(status_code=err.status, content={"detail": {"code": err.code, "message": err.message}})


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, err: RequestValidationError):
    first = err.errors()[0] if err.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", []) if p not in ("body",))
    message = f"Invalid input{f' ({where})' if where else ''}: {first.get('msg', 'please check your values')}."
    return JSONResponse(status_code=422, content={"detail": {"code": "validation_error", "message": message}})


# -------------------------------------------------------------- endpoints
@app.get("/", include_in_schema=False)
def root():
    return {"name": "Personalized Travel Itinerary Planner API", "version": VERSION, "docs": "/docs", "health": "/api/health"}


@app.get("/api/health", tags=["system"])
def health():
    """Quick check that the backend is running."""
    return {"status": "ok", "version": VERSION}


@app.get("/api/status", tags=["system"])
def status():
    """Tells the frontend whether AI mode or demo mode is active."""
    configured = ai_configured()
    return {
        "mode": "ai" if configured else "demo",
        "ai_configured": configured,
        "model": get_model() if configured else None,
        "fallback_to_demo": planner.fallback_enabled(),
        "version": VERSION,
    }


@app.post("/api/recommendations", response_model=RecommendationResponse, tags=["itinerary"])
async def recommendations(req: RecommendationRequest):
    """Three destination ideas for a vibe, budget, interests and season."""
    return await planner.recommend(req)


@app.post("/api/itinerary/generate", response_model=Itinerary, tags=["itinerary"])
async def generate(prefs: TripPreferences):
    """Create a full day-by-day itinerary (AI mode, or demo mode without a key)."""
    return await planner.generate_itinerary(prefs)


@app.post("/api/itinerary/regenerate-day", response_model=Itinerary, tags=["itinerary"])
async def regenerate_day(req: RegenerateDayRequest):
    """Re-plan one day and leave every other day untouched."""
    return await planner.regenerate_day(req)


@app.post("/api/itinerary/replace-activity", response_model=Itinerary, tags=["itinerary"])
async def replace_activity(req: ReplaceActivityRequest):
    """Swap a single activity (morning, lunch, afternoon or evening)."""
    return await planner.replace_activity(req)


@app.post("/api/export/pdf", tags=["export"])
def export_pdf(req: ExportRequest):
    """Download the itinerary as a PDF."""
    pdf = build_pdf(req.itinerary, req.preferences)
    slug = re.sub(r"[^a-z0-9]+", "-", req.itinerary.destination.lower()).strip("-") or "trip"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="itinerary-{slug}.pdf"'},
    )
