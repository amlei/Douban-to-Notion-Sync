from __future__ import annotations

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.core.auth.auth import decode_access_token
from src.core.auth.repository import AuthRepo
from db.engine import async_session_factory

WHITE_LIST: set[str] = {
    "/api/auth",
    "/api/chat",
}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Whitelist + preflight
        if path in WHITE_LIST or request.method == "OPTIONS":
            return await call_next(request)
        # WebSocket is handled in the route handler
        if path.startswith("/api/community/ws"):
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing token"})
        try:
            payload = decode_access_token(auth[7:])
            pk = payload["pk"]
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

        async with async_session_factory() as db:
            user = await AuthRepo.get_user_by_pk(db, pk)
            if not user or user.status != "active":
                return JSONResponse(status_code=401, content={"detail": "User not found"})

        request.state.user = user
        return await call_next(request)
