"""
Route registry for the PrioritAI API.

Re-exports router instances so :mod:`server.src.api` can expose them.

Exports:
    health_router:  ``GET /health`` — liveness probe.
    auth_router:   ``POST /auth/login``, ``GET /auth/users``.
    organizations_router: ``GET|POST /organizations``.
    settlements_router: ``GET /settlements``.
    events_router: ``POST /events`` — event creation pipeline.
    analyze_router: ``POST /analyze`` — legacy analysis endpoint.
"""

from .health import router as health_router
from .auth import router as auth_router
from .organizations import organizations_router, settlements_router
from .events import router as events_router
from .analyze import router as analyze_router
