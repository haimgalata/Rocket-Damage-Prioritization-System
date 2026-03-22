"""
POST /auth/login — Validate credentials and return user + organization.
GET  /users — List all users (for display names, etc.).

Organizations are listed at GET /organizations (see organizations router).
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import joinedload

from server.src.db.connection import get_db
from server.src.db.models import Organization, Settlement, User
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user: dict
    organization: dict


def _user_to_api(user: User) -> dict:
    """Map User model to client User shape (numeric DB ids + externalId for legacy)."""
    role_map = {"super_admin": "SUPER_ADMIN", "admin": "ADMIN", "operator": "OPERATOR"}
    role = role_map.get(user.role.name if user.role else "", "OPERATOR")
    return {
        "id": user.id,
        "externalId": user.external_id,
        "name": user.name,
        "email": user.email,
        "role": role,
        "roleId": user.role_id,
        "organizationId": user.organization_id,
        "createdAt": user.created_at.isoformat() if user.created_at else "",
        "isActive": True,
    }


def _org_to_api(org: Organization, settlement: Settlement | None = None) -> dict:
    """Map Organization model to client Organization shape (numeric DB ids)."""
    return {
        "id": org.id,
        "externalId": org.external_id,
        "name": org.name,
        "settlementId": org.settlement_id,
        "settlement_code": settlement.settlement_code if settlement else "",
        "createdAt": org.created_at.isoformat() if org.created_at else "",
    }


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest) -> LoginResponse:
    """Validate email/password and return user + organization."""
    with get_db() as db:
        user = (
            db.query(User)
            .options(joinedload(User.role), joinedload(User.organization).joinedload(Organization.settlement))
            .filter(User.email == req.email)
            .first()
        )
        if not user or user.password != req.password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        org = user.organization
        settlement = org.settlement if org else None
        return LoginResponse(
            user=_user_to_api(user),
            organization=_org_to_api(org, settlement) if org else {"id": "", "name": "", "settlement_code": "", "createdAt": ""},
        )


@router.get("/users")
def list_users() -> list[dict]:
    """List all users for display (id -> name mapping)."""
    with get_db() as db:
        users = db.query(User).all()
        return [_user_to_api(u) for u in users]
