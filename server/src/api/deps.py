"""FastAPI dependencies: current user from Bearer JWT."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import joinedload

from server.src.core.jwt_tokens import decode_access_token
from server.src.db.connection import get_db
from server.src.db.models import Organization, User

security = HTTPBearer(auto_error=False)


def get_bearer_token(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> str | None:
    if creds and creds.scheme.lower() == "bearer" and creds.credentials:
        return creds.credentials
    return None


def get_current_user(token: Annotated[str | None, Depends(get_bearer_token)]) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    with get_db() as db:
        user = (
            db.query(User)
            .options(
                joinedload(User.role),
                joinedload(User.organization).joinedload(Organization.settlement),
            )
            .filter(User.id == user_id)
            .first()
        )
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_roles(*allowed_db_names: str):
    """Dependency factory: allow only users whose role.name is in allowed_db_names."""

    def _checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        name = user.role.name if user.role else ""
        if name not in allowed_db_names:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return _checker
