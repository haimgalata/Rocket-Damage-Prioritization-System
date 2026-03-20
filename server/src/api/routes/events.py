"""
POST /events — Create a new damage event.
GET  /events/{event_id} — Fetch current state (used for polling until GIS is done).
"""

import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

UPLOADS_DIR = os.environ.get(
    "UPLOADS_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "uploads")
)
os.makedirs(UPLOADS_DIR, exist_ok=True)

from server.src.schemas.event import EventResponse
from server.src.services.ai_service import run_classification
from server.src.services.gis_service import get_gis_features
from server.src.services.priority_service import compute_priority, build_explanation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])

_event_store: dict[str, dict] = {}


def _run_gis_and_update(event_id: str, lat: float, lon: float, damage_score: int) -> None:
    """Background task: compute GIS features and update the stored event."""
    try:
        logger.info(f"[GIS Async] Starting GIS for event {event_id} at ({lat}, {lon})")
        gis_features = get_gis_features(lat, lon)
        final_score, multiplier = compute_priority(damage_score, gis_features)

        if event_id not in _event_store:
            logger.warning(f"[GIS Async] Event {event_id} no longer in store, skipping update")
            return

        event = _event_store[event_id]
        classification = event["damageClassification"]
        explanation = build_explanation(classification, damage_score, gis_features, final_score, multiplier)

        event.update({
            "priorityScore": final_score,
            "llmExplanation": explanation,
            "gisDetails": {
                "distHospitalM":     gis_features.get("dist_hospital_m",      -1),
                "distSchoolM":       gis_features.get("dist_school_m",        -1),
                "distRoadM":         gis_features.get("dist_roads_m",         -1),
                "distStrategicM":    gis_features.get("dist_military_base_m", -1),
                "populationDensity": gis_features.get("population_density",    0),
                "geoMultiplier":     multiplier,
            },
            "gisStatus": "done",
        })
        logger.info(f"[GIS Async] Event {event_id} updated — score={final_score:.2f}, multiplier={multiplier:.2f}")
    except Exception:
        logger.exception(f"[GIS Async] GIS failed for event {event_id}")
        if event_id in _event_store:
            _event_store[event_id]["gisStatus"] = "done"


@router.post("", response_model=EventResponse)
async def create_event(
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

        logger.info(f"[Event] New event at lat={lat}, lon={lon}")
        ai_result = run_classification(image_bytes)

        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        event_id = f"evt-{uuid.uuid4().hex[:8]}"

        image_url = ""
        if image and image_bytes:
            ext = os.path.splitext(image.filename)[1] if image.filename else ".jpg"
            filename = f"{event_id}{ext}"
            with open(os.path.join(UPLOADS_DIR, filename), "wb") as f:
                f.write(image_bytes)
            image_url = f"/uploads/{filename}"

        event = {
            "id":                   event_id,
            "organizationId":       organization_id,
            "createdBy":            created_by,
            "description":          description,
            "location": {
                "lat":     lat,
                "lng":     lon,
                "address": f"GPS {lat:.5f}, {lon:.5f}",
                "city":    "Israel",
            },
            "imageUrl":              image_url,
            "damageClassification":  ai_result["classification"],
            "damageScore":           ai_result["damage_score"],
            "priorityScore":         float(ai_result["damage_score"]),
            "gisDetails": {
                "distHospitalM":     -1,
                "distSchoolM":       -1,
                "distRoadM":         -1,
                "distStrategicM":    -1,
                "populationDensity": 0,
                "geoMultiplier":     1.0,
            },
            "gisStatus":    "pending",
            "status":       "pending",
            "hidden":       False,
            "llmExplanation": f"{ai_result['classification']} damage detected. GIS analysis in progress...",
            "aiModel":      "PrioritAI-v2.1",
            "tags":         tag_list,
            "createdAt":    datetime.utcnow().isoformat() + "Z",
        }

        _event_store[event_id] = event

        background_tasks.add_task(_run_gis_and_update, event_id, lat, lon, ai_result["damage_score"])

        logger.info(f"[Event] Created {event_id} — GIS queued as background task")
        return event

    except Exception as e:
        logger.exception("Event creation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_events() -> list:
    """Return all events in the store, sorted by priorityScore descending."""
    return sorted(_event_store.values(), key=lambda e: e.get("priorityScore", 0), reverse=True)


@router.get("/{event_id}")
async def get_event(event_id: str) -> dict:
    """Return current event state. Frontend polls this until gisStatus='done'."""
    if event_id not in _event_store:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return _event_store[event_id]
