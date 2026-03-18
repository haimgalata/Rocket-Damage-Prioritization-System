"""
POST /events — Create a new damage event.
Runs AI classification → GIS extraction → priority score.
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from server.src.schemas.event import EventResponse
from server.src.services.ai_service import run_classification
from server.src.services.gis_service import get_gis_features
from server.src.services.priority_service import compute_priority, build_explanation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventResponse)
async def create_event(
    lat:             float          = Form(...),
    lon:             float          = Form(...),
    description:     str            = Form(...),
    organization_id: str            = Form(...),
    created_by:      str            = Form(...),
    tags:            Optional[str]  = Form(default=""),
    image:           Optional[UploadFile] = File(default=None),
) -> EventResponse:
    """Create a new damage event by running the full AI + GIS pipeline.

    Accepts a ``multipart/form-data`` request containing location
    coordinates, metadata, and an optional damage image.  Executes
    three sequential pipeline stages and assembles the result into a
    complete ``EventResponse`` object.

    Pipeline stages:

    1. **AI classification** (:func:`~server.src.services.ai_service.run_classification`):
       Decodes the image bytes and runs CNN inference to produce a
       damage label (``"Light"`` / ``"Heavy"``), base score, and
       confidence value.  Falls back gracefully when no image is
       supplied or the model is unavailable.

    2. **GIS extraction** (:func:`~server.src.services.gis_service.get_gis_features`):
       Queries OSM for proximity distances (hospital, school, military/
       helipad, road) and the Israeli CBS dataset for population density
       at the supplied coordinates.

    3. **Priority scoring** (:func:`~server.src.services.priority_service.compute_priority`):
       Applies the weighted GIS formula to produce a clamped final score
       in [0.1, 10.0] and a human-readable explanation narrative.

    Args:
        lat (float): WGS-84 latitude of the damage event.
            Required ``multipart/form-data`` field.
        lon (float): WGS-84 longitude of the damage event.
            Required ``multipart/form-data`` field.
        description (str): Free-text description of the event.
            Required ``multipart/form-data`` field.
        organization_id (str): ID of the submitting organisation.
            Required ``multipart/form-data`` field.
        created_by (str): ID of the submitting user.
            Required ``multipart/form-data`` field.
        tags (str, optional): Comma-separated tag string
            (e.g. ``"gas,structural,urgent"``).  Defaults to ``""``.
        image (UploadFile, optional): Damage photo upload.
            Supported formats: JPEG, PNG, WebP.  When omitted, the AI
            pipeline uses its fallback scoring path.

    Returns:
        EventResponse: Fully assembled event object including the
            generated ``id``, ``priorityScore``, ``gisDetails``,
            ``llmExplanation``, and all submitted metadata.

    Raises:
        HTTPException: Status ``500`` if any unhandled exception
            propagates from the pipeline stages.  The ``detail`` field
            contains the exception message for debugging.
    """
    try:
        image_bytes = await image.read() if image else b""

        # ── Pipeline ──────────────────────────────────────────────────────────
        ai_result    = run_classification(image_bytes)
        gis_features = get_gis_features(lat, lon)
        final_score, multiplier = compute_priority(ai_result["damage_score"], gis_features)
        explanation  = build_explanation(
            ai_result["classification"], ai_result["damage_score"],
            gis_features, final_score, multiplier,
        )

        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        event_id = f"evt-{uuid.uuid4().hex[:8]}"

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
            "imageUrl":              "",
            "damageClassification":  ai_result["classification"],
            "damageScore":           ai_result["damage_score"],
            "priorityScore":         final_score,
            "gisDetails": {
                "distHospitalM":     gis_features.get("dist_hospital_m",     -1),
                "distSchoolM":       gis_features.get("dist_school_m",       -1),
                "distRoadM":         gis_features.get("dist_roads_m",        -1),
                "distStrategicM":    gis_features.get("dist_military_base_m", -1),
                "populationDensity": gis_features.get("population_density",   0),
                "geoMultiplier":     multiplier,
            },
            "status":       "pending",
            "hidden":       False,
            "llmExplanation": explanation,
            "aiModel":      "PrioritAI-v2.1",
            "tags":         tag_list,
            "createdAt":    datetime.utcnow().isoformat() + "Z",
        }

        logger.info(f"Event created: {event_id} | score={final_score:.2f}")
        return event

    except Exception as e:
        logger.exception("Event creation failed")
        raise HTTPException(status_code=500, detail=str(e))