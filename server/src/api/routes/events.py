"""
POST /events — Create a new damage event.
GET  /events/{event_id} — Fetch current state (used for polling until GIS is done).
"""

import logging
import os
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

UPLOADS_DIR = os.environ.get(
    "UPLOADS_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "uploads")
)
os.makedirs(UPLOADS_DIR, exist_ok=True)

from server.src.schemas.event import EventResponse
from server.src.services.event_service import create_event, get_event, list_events, run_gis_and_update

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventResponse)
async def create_event_route(
    background_tasks: BackgroundTasks,
    lat:             float          = Form(...),
    lon:             float          = Form(...),
    description:     str            = Form(...),
    organization_id: str            = Form(...),
    created_by:      str            = Form(...),
    tags:            Optional[str]  = Form(default=""),
    image:           Optional[UploadFile] = File(default=None),
) -> EventResponse:
    """Create event: run AI immediately, defer GIS to background."""
    try:
        image_bytes = await image.read() if image else b""

        image_url = ""
        if image and image_bytes:
            ext = os.path.splitext(image.filename)[1] if image.filename else ".jpg"
            filename = f"{uuid.uuid4().hex[:12]}{ext}"
            with open(os.path.join(UPLOADS_DIR, filename), "wb") as f:
                f.write(image_bytes)
            image_url = f"/uploads/{filename}"

        logger.info(f"[Event] New event at lat={lat}, lon={lon}")
        response, event_id, damage_score = create_event(
            lat=lat,
            lon=lon,
            description=description,
            organization_id=organization_id,
            created_by=created_by,
            tags=tags or "",
            image_bytes=image_bytes,
            image_url=image_url,
        )

        background_tasks.add_task(run_gis_and_update, event_id, lat, lon, damage_score)

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Event creation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_events_route() -> list:
    """Return all events sorted by priorityScore descending."""
    return list_events()


@router.get("/{event_id}")
async def get_event_route(event_id: str) -> dict:
    """Return current event state. Frontend polls this until gisStatus='done'."""
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event
