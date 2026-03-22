"""PrioritAI Backend — FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server.src.api import (
    health_router,
    auth_router,
    organizations_router,
    settlements_router,
    events_router,
    analyze_router,
)
from server.src.core.ai_logic import preload_model
from server.src.db.connection import get_db, init_db
from server.src.db.models import EventStatus, Role
from server.src.services.gis.demographics.population_density import preload_population_data

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

logging.basicConfig(level=logging.DEBUG)
logging.getLogger("server.src.core.ai_logic").setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)


def _ensure_db_ready() -> None:
    """Create tables and seed reference data if empty."""
    init_db()
    with get_db() as db:
        if db.query(EventStatus).count() == 0:
            for name in ("new", "in_progress", "done"):
                db.add(EventStatus(name=name))
            logger.info("Seeded event_status.")
        if db.query(Role).count() == 0:
            for name in ("super_admin", "admin", "operator"):
                db.add(Role(name=name))
            logger.info("Seeded roles.")

    # Settlements, organizations, users, and events are seeded via: python -m server.src.seed_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Pre-loading Keras model on startup...")
    preload_model()
    logger.info("Model ready.")
    logger.info("Pre-loading CBS population data...")
    preload_population_data()
    logger.info("CBS data ready.")
    logger.info("Initializing database...")
    _ensure_db_ready()
    logger.info("Database ready.")
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
        "http://localhost", "http://127.0.0.1",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(organizations_router)
app.include_router(settlements_router)
app.include_router(events_router)
app.include_router(analyze_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.src.main:app", host="0.0.0.0", port=8000, reload=False)
