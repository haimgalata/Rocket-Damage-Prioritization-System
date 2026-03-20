"""PrioritAI Backend — FastAPI application entry point."""

import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server.src.api import health_router, events_router, analyze_router
from server.src.api.routes.events import _event_store
from server.src.core.ai_logic import preload_model
from server.src.services.gis.demographics.population_density import preload_population_data

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

_SEED_JSON = os.path.join(os.path.dirname(__file__), "..", "seed_events.json")

logging.basicConfig(level=logging.DEBUG)
logging.getLogger("server.src.core.ai_logic").setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)


def _load_seed_events() -> None:
    """Populate _event_store from seed_events.json if it exists."""
    if not os.path.exists(_SEED_JSON):
        logger.info("No seed_events.json found — starting with empty event store.")
        return
    try:
        with open(_SEED_JSON, encoding="utf-8") as f:
            events: list[dict] = json.load(f)
        for ev in events:
            _event_store[ev["id"]] = ev
        logger.info(f"Loaded {len(events)} seed events from seed_events.json.")
    except Exception:
        logger.exception("Failed to load seed_events.json — continuing without seed data.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Pre-loading Keras model on startup...")
    preload_model()
    logger.info("Model ready.")
    logger.info("Pre-loading CBS population data...")
    preload_population_data()
    logger.info("CBS data ready.")
    _load_seed_events()
    yield


app = FastAPI(title="PrioritAI API", version="1.0.0", lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://localhost:5174",
        "http://localhost:5175", "http://localhost:5176",
        "http://localhost:5177", "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(events_router)
app.include_router(analyze_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.src.main:app", host="0.0.0.0", port=8000, reload=False)
