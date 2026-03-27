"""Health-check route — GET /health."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict:
    """Return liveness status for the PrioritAI API."""
    return {"status": "online", "version": "1.0.0"}
