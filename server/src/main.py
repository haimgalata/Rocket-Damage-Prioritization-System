"""
PrioritAI Backend — FastAPI application entry point.

Responsibilities of this module (intentionally narrow):

1. **App instantiation** — creates the :class:`fastapi.FastAPI` instance
   with title and version metadata used by the auto-generated OpenAPI
   docs at ``/docs``.

2. **CORS middleware** — allows cross-origin requests from Vite dev
   servers (ports 5173–5177), a local ``127.0.0.1`` variant, and a
   standard ``localhost:3000`` dev server.  All HTTP methods and headers
   are permitted; credentials (cookies) are allowed.

3. **Router registration** — includes the three ``APIRouter`` instances
   exported from :mod:`server.src.api`:

   - :mod:`~server.src.api.routes.health`  → ``GET /health``
   - :mod:`~server.src.api.routes.events`  → ``POST /events``
   - :mod:`~server.src.api.routes.analyze` → ``POST /analyze``

4. **Dev runner** — when executed directly (``python -m server.src.main``),
   launches a Uvicorn server on ``0.0.0.0:8000`` with hot-reload enabled.

No business logic lives here.  All scoring, GIS, and AI inference is
delegated to the service and core layers.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.src.api import health_router, events_router, analyze_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="PrioritAI API", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
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

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(events_router)
app.include_router(analyze_router)


# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.src.main:app", host="0.0.0.0", port=8000, reload=True)