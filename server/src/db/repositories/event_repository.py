"""Event repository — database operations for damage events."""

from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session, joinedload

from server.src.db.models import (
    Event,
    EventAnalysis,
    EventGIS,
    EventHistory,
    EventImage,
    EventStatus,
    EventTag,
    Organization,
    User,
)


def _resolve_org_id(db: Session, organization_id: str | int) -> int | None:
    """Resolve organization_id (external_id like 'org-1' or int) to DB id."""
    if isinstance(organization_id, int):
        org = db.query(Organization).filter(Organization.id == organization_id).first()
        return org.id if org else None
    org = db.query(Organization).filter(Organization.external_id == organization_id).first()
    if org:
        return org.id
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    return org.id if org else None


def _resolve_user_id(db: Session, created_by: str | int) -> int | None:
    """Resolve created_by (external_id like 'user-op-1' or int) to DB id."""
    if isinstance(created_by, int):
        user = db.query(User).filter(User.id == created_by).first()
        return user.id if user else None
    user = db.query(User).filter(User.external_id == created_by).first()
    if user:
        return user.id
    user = db.query(User).filter(User.id == created_by).first()
    return user.id if user else None


def _event_to_response(event: Event) -> dict[str, Any]:
    """Map Event model to API response shape (camelCase, nested)."""
    analysis = event.analysis[0] if event.analysis else None
    gis = event.gis
    images = event.images
    image_url = images[0].image_url if images else ""
    image_urls = [im.image_url for im in images] if images else []
    tags_list = [t.tag for t in event.tags]

    status_name = event.status.name if event.status else "new"

    gis_status = "done" if gis else "pending"
    gis_details = {
        "distHospitalM": float(gis.distance_hospital) if gis and gis.distance_hospital is not None else -1,
        "distSchoolM": float(gis.distance_school) if gis and gis.distance_school is not None else -1,
        "distRoadM": float(gis.distance_road) if gis and gis.distance_road is not None else -1,
        "distStrategicM": float(gis.distance_military) if gis and gis.distance_military is not None else -1,
        "populationDensity": float(gis.population_density) if gis and gis.population_density is not None else 0,
        "geoMultiplier": float(gis.geo_multiplier) if gis else 1.0,
    } if gis else {
        "distHospitalM": -1,
        "distSchoolM": -1,
        "distRoadM": -1,
        "distStrategicM": -1,
        "populationDensity": 0,
        "geoMultiplier": 1.0,
    }

    damage_classification = analysis.damage_classification if analysis else ""
    damage_score = int(analysis.damage_score) if analysis else 0
    priority_score = float(analysis.priority_score) if analysis else 0.0
    llm_explanation = analysis.explanation if analysis else ""
    ai_model = analysis.ai_model if analysis else "PrioritAI-v2.1"

    creator = event.created_by_user
    return {
        "id": event.id,
        "name": event.name,
        "organizationId": event.organization_id,
        "createdBy": event.created_by,
        "createdByName": creator.name if creator else str(event.created_by),
        "description": event.description,
        "location": {
            "lat": float(event.lat),
            "lng": float(event.lon),
            "address": event.address or f"GPS {float(event.lat):.5f}, {float(event.lon):.5f}",
            "city": event.city or "Israel",
        },
        "imageUrl": image_url,
        "imageUrls": image_urls,
        "damageClassification": damage_classification,
        "damageScore": damage_score,
        "priorityScore": priority_score,
        "gisDetails": gis_details,
        "gisStatus": gis_status,
        "status": status_name,
        "hidden": event.hidden,
        "llmExplanation": llm_explanation,
        "aiModel": ai_model,
        "tags": tags_list,
        "createdAt": event.created_at.isoformat().replace("+00:00", "Z") if event.created_at else "",
    }


class EventRepository:
    """Repository for event CRUD and GIS updates."""

    @staticmethod
    def create_event(
        db: Session,
        *,
        lat: float,
        lon: float,
        address: str,
        city: str,
        name: str | None = None,
        description: str,
        organization_id: str | int,
        created_by: str | int,
        damage_score: float | int,
        damage_classification: str,
        priority_score: float,
        explanation: str,
        ai_model: str = "PrioritAI-v2.1",
        image_url: str = "",
        tags: list[str] | None = None,
    ) -> Event:
        """Create event with initial analysis. GIS is added later via update_gis."""
        org_db_id = _resolve_org_id(db, organization_id)
        user_db_id = _resolve_user_id(db, created_by)
        if org_db_id is None:
            raise ValueError(f"Organization not found: {organization_id}")
        if user_db_id is None:
            raise ValueError(f"User not found: {created_by}")

        status_new = db.query(EventStatus).filter(EventStatus.name == "new").first()
        if not status_new:
            status_new = db.query(EventStatus).first()
        if not status_new:
            raise ValueError("No event status found — run seed_db or ensure event_status is populated")

        event = Event(
            lat=Decimal(str(lat)),
            lon=Decimal(str(lon)),
            address=address or f"GPS {lat:.5f}, {lon:.5f}",
            city=city or "Israel",
            name=name or None,
            description=description,
            organization_id=org_db_id,
            created_by=user_db_id,
            status_id=status_new.id,
            hidden=False,
        )
        db.add(event)
        db.flush()

        db.add(
            EventAnalysis(
                event_id=event.id,
                damage_score=Decimal(str(damage_score)),
                damage_classification=damage_classification,
                priority_score=Decimal(str(priority_score)),
                explanation=explanation,
                ai_model=ai_model,
            )
        )
        if image_url:
            db.add(EventImage(event_id=event.id, image_url=image_url))
        for t in (tags or []):
            tag = t.strip()
            if tag:
                db.add(EventTag(event_id=event.id, tag=tag))
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def get_by_id(db: Session, event_id: int | str) -> Event | None:
        """Get event by id (int or string of int)."""
        try:
            eid = int(event_id)
        except (ValueError, TypeError):
            return None
        return (
            db.query(Event)
            .options(
                joinedload(Event.organization),
                joinedload(Event.created_by_user),
                joinedload(Event.status),
                joinedload(Event.analysis),
                joinedload(Event.gis),
                joinedload(Event.images),
                joinedload(Event.tags),
            )
            .filter(Event.id == eid)
            .first()
        )

    @staticmethod
    def get_event_response(db: Session, event_id: int | str) -> dict[str, Any] | None:
        """Get event as API response dict, or None if not found."""
        event = EventRepository.get_by_id(db, event_id)
        if not event:
            return None
        return _event_to_response(event)

    @staticmethod
    def list_all(db: Session) -> list[dict[str, Any]]:
        """List all events as API response dicts, sorted by priorityScore descending."""
        events = (
            db.query(Event)
            .options(
                joinedload(Event.organization),
                joinedload(Event.created_by_user),
                joinedload(Event.status),
                joinedload(Event.analysis),
                joinedload(Event.gis),
                joinedload(Event.images),
                joinedload(Event.tags),
            )
            .all()
        )
        result = [_event_to_response(e) for e in events]
        return sorted(result, key=lambda x: x.get("priorityScore", 0), reverse=True)

    @staticmethod
    def update_gis(
        db: Session,
        event_id: int,
        *,
        distance_hospital: float | None = None,
        distance_school: float | None = None,
        distance_road: float | None = None,
        distance_military: float | None = None,
        population_density: float | None = None,
        geo_multiplier: float = 1.0,
        priority_score: float | None = None,
        explanation: str | None = None,
    ) -> bool:
        """Insert or update EventGIS and update EventAnalysis. Returns True if event exists."""
        event = EventRepository.get_by_id(db, event_id)
        if not event:
            return False

        existing_gis = db.query(EventGIS).filter(EventGIS.event_id == event_id).first()
        if existing_gis:
            existing_gis.distance_hospital = Decimal(str(distance_hospital)) if distance_hospital is not None else existing_gis.distance_hospital
            existing_gis.distance_school = Decimal(str(distance_school)) if distance_school is not None else existing_gis.distance_school
            existing_gis.distance_road = Decimal(str(distance_road)) if distance_road is not None else existing_gis.distance_road
            existing_gis.distance_military = Decimal(str(distance_military)) if distance_military is not None else existing_gis.distance_military
            existing_gis.population_density = Decimal(str(population_density)) if population_density is not None else existing_gis.population_density
            existing_gis.geo_multiplier = Decimal(str(geo_multiplier))
        else:
            gis = EventGIS(
                event_id=event_id,
                distance_hospital=Decimal(str(distance_hospital)) if distance_hospital is not None else None,
                distance_school=Decimal(str(distance_school)) if distance_school is not None else None,
                distance_road=Decimal(str(distance_road)) if distance_road is not None else None,
                distance_military=Decimal(str(distance_military)) if distance_military is not None else None,
                population_density=Decimal(str(population_density)) if population_density is not None else None,
                geo_multiplier=Decimal(str(geo_multiplier)),
            )
            db.add(gis)

        if event.analysis:
            a = event.analysis[0]
            if priority_score is not None:
                a.priority_score = Decimal(str(priority_score))
            if explanation is not None:
                a.explanation = explanation

        db.commit()
        return True

    @staticmethod
    def list_by_organization(db: Session, organization_id: int) -> list[dict[str, Any]]:
        """List events for one organization, sorted by priorityScore descending."""
        events = (
            db.query(Event)
            .options(
                joinedload(Event.organization),
                joinedload(Event.created_by_user),
                joinedload(Event.status),
                joinedload(Event.analysis),
                joinedload(Event.gis),
                joinedload(Event.images),
                joinedload(Event.tags),
            )
            .filter(Event.organization_id == organization_id)
            .all()
        )
        result = [_event_to_response(e) for e in events]
        return sorted(result, key=lambda x: x.get("priorityScore", 0), reverse=True)

    @staticmethod
    def _history_entries(db: Session, event_id: int) -> list[dict[str, Any]]:
        rows = (
            db.query(EventHistory)
            .filter(EventHistory.event_id == event_id)
            .order_by(EventHistory.changed_at.desc())
            .all()
        )
        out: list[dict[str, Any]] = []
        for h in rows:
            old_s = db.query(EventStatus).filter(EventStatus.id == h.old_status_id).first()
            new_s = db.query(EventStatus).filter(EventStatus.id == h.new_status_id).first()
            changer = db.query(User).filter(User.id == h.changed_by).first()
            out.append(
                {
                    "oldStatus": old_s.name if old_s else "",
                    "newStatus": new_s.name if new_s else "",
                    "changedBy": h.changed_by,
                    "changedByName": changer.name if changer else "",
                    "changedAt": h.changed_at.isoformat().replace("+00:00", "Z") if h.changed_at else "",
                }
            )
        return out

    @staticmethod
    def get_event_detail_response(db: Session, event_id: int | str) -> dict[str, Any] | None:
        """Full event payload including history (for detail page)."""
        base = EventRepository.get_event_response(db, event_id)
        if base is None:
            return None
        try:
            eid = int(event_id)
        except (ValueError, TypeError):
            return None
        base["history"] = EventRepository._history_entries(db, eid)
        return base

    @staticmethod
    def delete_event(db: Session, event_id: int) -> bool:
        """Delete event and cascade its children (images, gis, analysis, tags, history).
        Returns True if the event existed and was deleted, False if not found."""
        event = EventRepository.get_by_id(db, event_id)
        if not event:
            return False
        db.delete(event)
        return True

    @staticmethod
    def update_event_patch(
        db: Session,
        event_id: int,
        *,
        changed_by_user_id: int,
        status_name: str | None = None,
        hidden: bool | None = None,
    ) -> dict[str, Any] | None:
        """Update status and/or hidden; append event_history when status changes."""
        event = EventRepository.get_by_id(db, event_id)
        if not event:
            return None

        if status_name is None and hidden is None:
            return EventRepository.get_event_response(db, event_id)

        if status_name is not None:
            new_st = db.query(EventStatus).filter(EventStatus.name == status_name).first()
            if not new_st:
                raise ValueError(f"Unknown status: {status_name}")
            old_id = event.status_id
            if old_id != new_st.id:
                event.status_id = new_st.id
                db.add(
                    EventHistory(
                        event_id=event_id,
                        old_status_id=old_id,
                        new_status_id=new_st.id,
                        changed_by=changed_by_user_id,
                    )
                )

        if hidden is not None:
            event.hidden = hidden

        db.commit()
        return EventRepository.get_event_response(db, event_id)
