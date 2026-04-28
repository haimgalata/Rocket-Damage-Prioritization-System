"""
POST /events — Create (auth).
GET  /events — List scoped by role/org (auth).
GET  /events/{event_id} — Detail + history (auth).
PATCH /events/{event_id} — Status / hidden (auth).
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from server.src.api.deps import get_current_user
from server.src.db.models import User
from server.src.schemas.event import EventResponse
from server.src.services.event_service import (
    create_event,
    get_event,
    get_event_detail,
    list_events_for_principal,
    patch_event,
    run_gis_and_update,
)
from server.src.services.storage.supabase_storage import SupabaseStorageError, upload_event_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


def _role_name(user: User) -> str:
    return user.role.name if user.role else ""


def _can_access_org(user: User, organization_id: int) -> bool:
    if _role_name(user) == "super_admin":
        return True
    return user.organization_id == organization_id


def _can_change_status(user: User) -> bool:
    return _role_name(user) in ("super_admin", "admin")


class PatchEventBody(BaseModel):
    status: Optional[str] = None
    hidden: Optional[bool] = None


@router.post("", response_model=EventResponse)
async def create_event_route(
    background_tasks: BackgroundTasks,
    current: Annotated[User, Depends(get_current_user)],
    lat: float = Form(...),
    lon: float = Form(...),
    description: str = Form(...),
    organization_id: str = Form(...),
    created_by: str = Form(default=""),  # ignored; always current user
    tags: Optional[str] = Form(default=""),
    image: Optional[UploadFile] = File(default=None),
) -> EventResponse:
    """Create event: operator/admin in org; super_admin any org."""
    try:
        org_id_int = int(organization_id)
    except ValueError:
        org_id_int = -1
    if not _can_access_org(current, org_id_int):
        raise HTTPException(status_code=403, detail="Cannot create events for this organization")

    try:
        image_bytes = await image.read() if image else b""

        image_url = ""
        if image and image_bytes:
            image_url = upload_event_image(image_bytes, image.filename, image.content_type)

        logger.info(f"[Event] New event at lat={lat}, lon={lon}")
        response, event_id, damage_score = create_event(
            lat=lat,
            lon=lon,
            description=description,
            organization_id=organization_id,
            created_by=str(current.id),  # always authenticated user
            tags=tags or "",
            image_bytes=image_bytes,
            image_url=image_url,
        )

        background_tasks.add_task(run_gis_and_update, event_id, lat, lon, damage_score)

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SupabaseStorageError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Event creation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_events_route(current: Annotated[User, Depends(get_current_user)]) -> list:
    """Return events visible to the current user."""
    return list_events_for_principal(
        role_db_name=_role_name(current),
        organization_id=current.organization_id,
    )


@router.get("/{event_id}")
async def get_event_route(
    event_id: str,
    current: Annotated[User, Depends(get_current_user)],
    detail: bool = Query(False, description="Include status history"),
) -> dict:
    """Return event; use detail=true for history payload."""
    if detail:
        event = get_event_detail(event_id)
    else:
        event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    org_id = event.get("organizationId")
    if org_id is not None and not _can_access_org(current, int(org_id)):
        raise HTTPException(status_code=403, detail="Access denied")
    return event


@router.patch("/{event_id}")
async def patch_event_route(
    event_id: str,
    body: PatchEventBody,
    current: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Update status (admin/super_admin) and/or hidden."""
    try:
        eid = int(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event id")
    existing = get_event(event_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Event not found")
    org_id = int(existing["organizationId"])
    if not _can_access_org(current, org_id):
        raise HTTPException(status_code=403, detail="Access denied")

    if (body.status is not None or body.hidden is not None) and not _can_change_status(current):
        raise HTTPException(status_code=403, detail="Only admins can change event status or visibility")

    updated = patch_event(
        eid,
        changed_by_user_id=current.id,
        status_name=body.status,
        hidden=body.hidden,
    )
    if updated is None:
        if body.status is not None:
            raise HTTPException(status_code=400, detail="Invalid status")
        raise HTTPException(status_code=500, detail="Update failed")
    return updated
