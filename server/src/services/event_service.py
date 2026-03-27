"""Event service — orchestrates AI, GIS, priority, and persistence."""

import logging
from typing import Any

from server.src.db.connection import get_db
from server.src.db.repositories.event_repository import EventRepository
from server.src.services.ai_service import run_classification
from server.src.services.gis_service import get_gis_features
from server.src.services.priority_service import compute_priority, build_explanation

logger = logging.getLogger(__name__)


def create_event(
    *,
    lat: float,
    lon: float,
    description: str,
    organization_id: str,
    created_by: str,
    tags: str = "",
    image_bytes: bytes = b"",
    image_url: str = "",
) -> tuple[dict[str, Any], int, float]:
    """Create event: run AI, persist to DB. Returns (API response, event_id, damage_score).
    Caller should queue run_gis_and_update(event_id, lat, lon, damage_score) as background task."""
    ai_result = run_classification(image_bytes)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    initial_explanation = (
        f"{ai_result['classification']} damage detected. GIS analysis in progress..."
    )

    with get_db() as db:
        event = EventRepository.create_event(
            db,
            lat=lat,
            lon=lon,
            address=f"GPS {lat:.5f}, {lon:.5f}",
            city="Israel",
            description=description,
            organization_id=organization_id,
            created_by=created_by,
            damage_score=ai_result["damage_score"],
            damage_classification=ai_result["classification"],
            priority_score=float(ai_result["damage_score"]),
            explanation=initial_explanation,
            ai_model="PrioritAI-v2.1",
            image_url=image_url,
            tags=tag_list,
        )
        event_id = event.id
        damage_score = ai_result["damage_score"]

    logger.info(f"[Event] Created {event_id} — GIS queued as background task")
    with get_db() as db:
        response = EventRepository.get_event_response(db, event_id)
    return response, event_id, damage_score


def run_gis_and_update(event_id: int, lat: float, lon: float, damage_score: float | int) -> None:
    """Background task: compute GIS features and update the stored event."""
    try:
        logger.info(f"[GIS Async] Starting GIS for event {event_id} at ({lat}, {lon})")
        gis_features = get_gis_features(lat, lon)
        final_score, multiplier = compute_priority(int(damage_score), gis_features)

        with get_db() as db:
            event = EventRepository.get_by_id(db, event_id)
            if not event:
                logger.warning(f"[GIS Async] Event {event_id} no longer in store, skipping update")
                return

            classification = event.analysis[0].damage_classification if event.analysis else ""
            explanation = build_explanation(
                classification, int(damage_score), gis_features, final_score, multiplier
            )

            EventRepository.update_gis(
                db,
                event_id,
                distance_hospital=gis_features.get("dist_hospital_m"),
                distance_school=gis_features.get("dist_school_m"),
                distance_road=gis_features.get("dist_roads_m"),
                distance_military=gis_features.get("dist_military_base_m"),
                population_density=gis_features.get("population_density"),
                geo_multiplier=multiplier,
                priority_score=final_score,
                explanation=explanation,
            )

        logger.info(f"[GIS Async] Event {event_id} updated — score={final_score:.2f}, multiplier={multiplier:.2f}")
    except Exception:
        logger.exception(f"[GIS Async] GIS failed for event {event_id}")
        # Mark gis as done so frontend stops polling (with fallback data)
        try:
            with get_db() as db:
                EventRepository.update_gis(db, event_id)
        except Exception:
            logger.exception(f"[GIS Async] Failed to mark event {event_id} gis done")


def get_event(event_id: str) -> dict[str, Any] | None:
    """Get event by id. Returns None if not found."""
    with get_db() as db:
        return EventRepository.get_event_response(db, event_id)


def list_events() -> list[dict[str, Any]]:
    """List all events sorted by priorityScore descending."""
    with get_db() as db:
        return EventRepository.list_all(db)


def list_events_for_principal(*, role_db_name: str, organization_id: int | None) -> list[dict[str, Any]]:
    """Scope events: super_admin sees all; others only their organization."""
    with get_db() as db:
        if role_db_name == "super_admin":
            return EventRepository.list_all(db)
        if organization_id is None:
            return []
        return EventRepository.list_by_organization(db, organization_id)


def get_event_detail(event_id: str) -> dict[str, Any] | None:
    with get_db() as db:
        return EventRepository.get_event_detail_response(db, event_id)


def patch_event(
    event_id: int,
    *,
    changed_by_user_id: int,
    status_name: str | None = None,
    hidden: bool | None = None,
) -> dict[str, Any] | None:
    with get_db() as db:
        try:
            return EventRepository.update_event_patch(
                db,
                event_id,
                changed_by_user_id=changed_by_user_id,
                status_name=status_name,
                hidden=hidden,
            )
        except ValueError:
            return None
