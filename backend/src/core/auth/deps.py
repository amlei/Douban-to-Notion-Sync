from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from db.engine import get_session
from db.models import User
from src.core.auth.auth import decode_access_token
from src.core.auth.repository import AuthRepo

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_session),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    pk = payload.get("pk")
    if pk is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await AuthRepo.get_user_by_pk(db, pk)
    if user is None or user.status != "active":
        raise HTTPException(status_code=401, detail="User not found")
    return user
