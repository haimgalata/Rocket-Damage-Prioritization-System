"""
POST /auth/login — credentials → JWT + user + organization.
GET  /auth/me — current user (Bearer).
PATCH /auth/password — change password.
GET  /auth/users — scoped user list.
POST /auth/users — create user (admin / super_admin rules).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import joinedload

from server.src.api.deps import get_current_user, require_roles
from server.src.core.jwt_tokens import create_access_token
from server.src.db.connection import get_db
from server.src.db.models import Organization, Role, Settlement, User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    organization: dict


class PasswordPatchRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=4)


class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3)
    password: str = Field(default="1234", min_length=4)
    role: str  # OPERATOR | ADMIN (client enum string)
    organizationId: int = Field(..., ge=1)


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
        "isActive": getattr(user, "is_active", True),
    }


def _org_to_api(org: Organization, settlement: Settlement | None = None) -> dict:
    """Map Organization model to client Organization shape (numeric DB ids)."""
    return {
        "id": org.id,
        "externalId": org.external_id,
        "name": org.name,
        "settlementId": org.settlement_id,
        "settlement_code": settlement.settlement_code if settlement else "",
        "settlementName": settlement.name if settlement else "",
        "createdAt": org.created_at.isoformat() if org.created_at else "",
    }


def _empty_org() -> dict:
    return {
        "id": 0,
        "name": "",
        "settlement_code": "",
        "settlementName": "",
        "settlementId": 0,
        "createdAt": "",
    }


def _client_role_to_db(role: str) -> str | None:
    m = {"SUPER_ADMIN": "super_admin", "ADMIN": "admin", "OPERATOR": "operator"}
    return m.get(role)


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest) -> LoginResponse:
    """Validate email/password and return JWT + user + organization."""
    with get_db() as db:
        user = (
            db.query(User)
            .options(
                joinedload(User.role),
                joinedload(User.organization).joinedload(Organization.settlement),
            )
            .filter(User.email == req.email)
            .first()
        )
        if not user or user.password != req.password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not getattr(user, "is_active", True):
            raise HTTPException(status_code=401, detail="Account has been deactivated")
        org = user.organization
        settlement = org.settlement if org else None
        token = create_access_token(user_id=user.id)
        return LoginResponse(
            access_token=token,
            token_type="bearer",
            user=_user_to_api(user),
            organization=_org_to_api(org, settlement) if org else _empty_org(),
        )


@router.get("/me", response_model=LoginResponse)
def auth_me(current: Annotated[User, Depends(get_current_user)]) -> LoginResponse:
    """Return fresh user + organization for the Bearer token (session refresh)."""
    org = current.organization
    settlement = org.settlement if org else None
    token = create_access_token(user_id=current.id)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=_user_to_api(current),
        organization=_org_to_api(org, settlement) if org else _empty_org(),
    )


@router.patch("/password")
def change_password(
    body: PasswordPatchRequest,
    current: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Update password after verifying current password."""
    if current.password != body.current_password:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    with get_db() as db:
        u = db.query(User).filter(User.id == current.id).first()
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        u.password = body.new_password
    return {"ok": True}


@router.get("/users")
def list_users(current: Annotated[User, Depends(get_current_user)]) -> list[dict]:
    """List users: super_admin sees all; others see same organization only."""
    role_name = current.role.name if current.role else ""
    with get_db() as db:
        q = db.query(User).options(joinedload(User.role))
        if role_name != "super_admin":
            if current.organization_id is None:
                return []
            q = q.filter(User.organization_id == current.organization_id)
        users = q.all()
        return [_user_to_api(u) for u in users]


class PatchUserRequest(BaseModel):
    is_active: bool | None = None


@router.patch("/users/{user_id}", status_code=200)
def patch_user(
    user_id: int,
    body: PatchUserRequest,
    current: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Toggle user active status. Super admin and admin only.
    Guard: cannot deactivate the sole active admin of an organization."""
    role_name = current.role.name if current.role else ""
    if role_name not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    with get_db() as db:
        target = (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.id == user_id)
            .first()
        )
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        if role_name == "admin" and target.organization_id != current.organization_id:
            raise HTTPException(status_code=403, detail="Cannot manage users outside your organization")

        if body.is_active is False:
            target_role_name = target.role.name if target.role else ""
            if target_role_name == "admin" and target.organization_id:
                other_active_admins = (
                    db.query(User)
                    .join(User.role)
                    .filter(
                        User.organization_id == target.organization_id,
                        User.is_active.is_(True),
                        Role.name == "admin",
                        User.id != user_id,
                    )
                    .count()
                )
                if other_active_admins == 0:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Cannot deactivate the only active admin. "
                            "Please appoint or activate another admin for this organization first."
                        ),
                    )

        if body.is_active is not None:
            target.is_active = body.is_active
            db.flush()
            db.refresh(target)
            target = (
                db.query(User)
                .options(joinedload(User.role))
                .filter(User.id == user_id)
                .first()
            )
        return _user_to_api(target)


@router.post("/users", status_code=201)
def create_user(
    body: CreateUserRequest,
    current: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Create user. Admin: operators only, same org. Super admin: admin or operator, any org."""
    role_name = current.role.name if current.role else ""
    db_role = _client_role_to_db(body.role)
    if db_role is None or db_role == "super_admin":
        raise HTTPException(status_code=400, detail="Invalid role")
    if role_name == "admin":
        if db_role != "operator":
            raise HTTPException(status_code=403, detail="Admins may only create operators")
        if current.organization_id != body.organizationId:
            raise HTTPException(status_code=403, detail="Cannot assign users outside your organization")
    elif role_name == "super_admin":
        if db_role not in ("admin", "operator"):
            raise HTTPException(status_code=400, detail="Invalid role for this action")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    with get_db() as db:
        if db.query(User).filter(User.email == body.email.strip()).first():
            raise HTTPException(status_code=409, detail="Email already registered")
        org = db.query(Organization).filter(Organization.id == body.organizationId).first()
        if not org:
            raise HTTPException(status_code=400, detail="organizationId not found")
        r = db.query(Role).filter(Role.name == db_role).first()
        if not r:
            raise HTTPException(status_code=500, detail="Role not configured")
        u = User(
            name=body.name.strip(),
            email=body.email.strip(),
            password=body.password,
            role_id=r.id,
            organization_id=body.organizationId,
        )
        db.add(u)
        db.flush()
        db.refresh(u)
        u = (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.id == u.id)
            .first()
        )
        return _user_to_api(u)
