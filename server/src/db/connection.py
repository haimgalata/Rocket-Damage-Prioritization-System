"""Database connection and session management."""

import logging
import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.engine import URL
from sqlalchemy.engine.url import make_url

from server.src.db import models  # noqa: F401 — ensure models are registered
from server.src.db.models import Base

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://prioritai:prioritai@localhost:5432/prioritai",
)


def _safe_db_target(raw_url: str) -> dict[str, str]:
    """Return non-sensitive DB target fields for startup logs."""
    try:
        parsed: URL = make_url(raw_url)
    except Exception:
        return {
            "backend": "unknown",
            "host": "unknown",
            "port": "unknown",
            "database": "unknown",
            "sslmode": "unknown",
        }

    sslmode = parsed.query.get("sslmode")
    return {
        "backend": parsed.drivername or "unknown",
        "host": parsed.host or "unknown",
        "port": str(parsed.port or "default"),
        "database": parsed.database or "unknown",
        "sslmode": sslmode or "not_set",
    }


_target = _safe_db_target(DATABASE_URL)
logger.info(
    "Database target: backend=%s host=%s port=%s database=%s sslmode=%s",
    _target["backend"],
    _target["host"],
    _target["port"],
    _target["database"],
    _target["sslmode"],
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)


def init_db() -> None:
    """Create all tables from SQLAlchemy models (full schema; no separate SQL migrations)."""
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """Provide a transactional scope for database operations."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
