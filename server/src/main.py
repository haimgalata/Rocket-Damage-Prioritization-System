"""PrioritAI Backend — FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server.src.api import health_router, events_router, analyze_router
from server.src.core.ai_logic import preload_model
from server.src.db.connection import get_db, init_db
from server.src.db.models import EventStatus, Organization, Role, Settlement, User
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

    with get_db() as db:
        if db.query(Settlement).count() == 0:
            role_sa = db.query(Role).filter(Role.name == "super_admin").first()
            role_admin = db.query(Role).filter(Role.name == "admin").first()
            role_op = db.query(Role).filter(Role.name == "operator").first()
            if role_sa and role_admin and role_op:
                s1 = Settlement(name="Tel Aviv", settlement_code="TAV-001")
                s2 = Settlement(name="South", settlement_code="STH-002")
                s3 = Settlement(name="Jerusalem", settlement_code="JRS-003")
                db.add_all([s1, s2, s3])
                db.flush()
                o1 = Organization(name="Tel Aviv Municipality", settlement_id=s1.id, external_id="org-1")
                o2 = Organization(name="South Authority", settlement_id=s2.id, external_id="org-2")
                o3 = Organization(name="Jerusalem Municipality", settlement_id=s3.id, external_id="org-3")
                db.add_all([o1, o2, o3])
                db.flush()
                for u in [
                    ("Sarah Cohen", "sarah@prioritai.gov", role_sa.id, o1.id, "user-sa-1"),
                    ("David Levi", "david@tel-aviv.gov", role_admin.id, o1.id, "user-admin-1"),
                    ("Miriam Shapiro", "miriam@tel-aviv.gov", role_op.id, o1.id, "user-op-1"),
                    ("Yosef Mizrahi", "yosef@tel-aviv.gov", role_op.id, o1.id, "user-op-2"),
                    ("Ruth Goldstein", "ruth@south.gov", role_admin.id, o2.id, "user-admin-2"),
                    ("Eli Shapira", "eli@jerusalem.gov", role_admin.id, o3.id, "user-admin-3"),
                ]:
                    db.add(User(name=u[0], email=u[1], password="placeholder", role_id=u[2], organization_id=u[3], external_id=u[4]))
                logger.info("Seeded settlements, organizations, users.")


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
