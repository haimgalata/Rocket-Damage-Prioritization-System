"""
GET  /organizations — List organizations (scoped by role).
POST /organizations — Create organization (super_admin only).
GET  /settlements   — List settlements (authenticated).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import joinedload

from server.src.api.deps import get_current_user, require_roles
from server.src.api.routes.auth import _org_to_api
from server.src.db.connection import get_db
from server.src.db.models import Organization, Settlement, User

organizations_router = APIRouter(tags=["organizations"])
settlements_router = APIRouter(prefix="/settlements", tags=["settlements"])


class CreateOrganizationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    settlement_id: int = Field(..., ge=1)
    assign_admin_external_id: str | None = Field(
        default=None,
        description="Optional: external_id of an admin user to move to this organization",
    )


@organizations_router.get("/organizations")
def list_organizations(current: Annotated[User, Depends(get_current_user)]) -> list[dict]:
    """Super admin: all orgs. Others: own organization only."""
    role_name = current.role.name if current.role else ""
    with get_db() as db:
        q = (
            db.query(Organization)
            .options(
                joinedload(Organization.settlement),
                joinedload(Organization.users).joinedload(User.role),
            )
        )
        if role_name != "super_admin":
            if current.organization_id is None:
                return []
            q = q.filter(Organization.id == current.organization_id)
        orgs = q.all()
        result = []
        for o in orgs:
            d = _org_to_api(o, o.settlement)
            admin = next((u for u in o.users if u.role and u.role.name == "admin"), None)
            d["adminId"] = admin.id if admin else None
            result.append(d)
        return result


@organizations_router.post("/organizations")
def create_organization(
    body: CreateOrganizationRequest,
    _auth: Annotated[User, Depends(require_roles("super_admin"))],
) -> dict:
    """Insert organization; optionally reassign an existing admin user to it."""
    with get_db() as db:
        settlement = db.query(Settlement).filter(Settlement.id == body.settlement_id).first()
        if not settlement:
            raise HTTPException(status_code=400, detail="settlement_id not found")

        name_clean = body.name.strip()
        existing_name = db.query(Organization).filter(Organization.name == name_clean).first()
        if existing_name:
            raise HTTPException(status_code=409, detail="An organization with this name already exists")

        ext = f"org-{uuid.uuid4().hex[:12]}"
        while db.query(Organization).filter(Organization.external_id == ext).first():
            ext = f"org-{uuid.uuid4().hex[:12]}"

        org = Organization(
            name=name_clean,
            settlement_id=body.settlement_id,
            external_id=ext,
        )
        db.add(org)
        db.flush()

        if body.assign_admin_external_id:
            aid = body.assign_admin_external_id.strip()
            user = (
                db.query(User)
                .options(joinedload(User.role))
                .filter(User.external_id == aid)
                .first()
            )
            if not user and aid.isdigit():
                user = (
                    db.query(User)
                    .options(joinedload(User.role))
                    .filter(User.id == int(aid))
                    .first()
                )
            if not user:
                raise HTTPException(status_code=400, detail="assign_admin_external_id: user not found")
            if not user.role or user.role.name != "admin":
                raise HTTPException(status_code=400, detail="Selected user is not an admin")
            user.organization_id = org.id

        admins = (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.organization_id == org.id)
            .all()
        )
        admin = next((u for u in admins if u.role and u.role.name == "admin"), None)
        d = _org_to_api(org, settlement)
        d["adminId"] = admin.id if admin else None
        return d


@settlements_router.get("")
def list_settlements(_user: Annotated[User, Depends(get_current_user)]) -> list[dict]:
    """List settlements for dropdowns."""
    with get_db() as db:
        rows = db.query(Settlement).order_by(Settlement.name).all()
        return [
            {"id": s.id, "name": s.name, "settlement_code": s.settlement_code}
            for s in rows
        ]
