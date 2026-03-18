"""
Health-check route — ``GET /health``.

Provides a lightweight liveness probe that external monitoring tools,
load balancers, and the frontend can poll to confirm the API process
is running and accepting requests.  No authentication is required and
no external dependencies (database, model, GIS) are checked.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict:
    """Return a liveness status for the PrioritAI API.

    A ``200 OK`` response indicates that the FastAPI process is alive
    and the routing layer is functional.  This endpoint deliberately
    does **not** probe the Keras model, OSM API connectivity, or CBS
    data files — it is intended as a fast ping-style check only.

    Returns:
        dict: A fixed status payload with the following keys:

            - ``"status"`` (str): Always ``"online"`` when reachable.
            - ``"version"`` (str): Current API version string
              (e.g. ``"1.0.0"``).
    """
    return {"status": "online", "version": "1.0.0"}