"""
API package for the PrioritAI backend.

Re-exports the router instances from :mod:`server.src.api.routes`
so that :mod:`server.src.main` can register them with a single import.

Exports:
    health_router:  ``GET /health``   — liveness probe.
    events_router:  ``POST /events``  — event creation pipeline.
    analyze_router: ``POST /analyze`` — legacy analysis endpoint.
"""

from .routes import health_router, events_router, analyze_router