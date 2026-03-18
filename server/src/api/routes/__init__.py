"""
Route registry for the PrioritAI API.

Re-exports the three ``APIRouter`` instances so that
:mod:`server.src.api` can expose them through a single import path.

Exports:
    health_router:  ``GET /health`` — liveness probe.
    events_router:  ``POST /events`` — event creation pipeline.
    analyze_router: ``POST /analyze`` — legacy analysis endpoint.
"""

from .health import router as health_router
from .events import router as events_router
from .analyze import router as analyze_router