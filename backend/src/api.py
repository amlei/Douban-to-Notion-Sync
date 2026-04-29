import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session, init_db
from db.engine import async_session_factory
from db.models import User
from db.repository import CommunityMetaRepo, DataRepo, BookmarkRepo
from db.models import PLATFORM_DOUBAN, PLATFORM_WEREAD
from src.api.douban import AsyncBindManager as DoubanBindManager
from src.api.douban import supported_platforms
from src.api.weread import WereadBindManager
from src.core.auth.auth import decode_access_token
from src.core.middleware import AuthMiddleware
from src.core.auth.repository import AuthRepo
from src.core.auth.routes import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])


def _user(request: Request) -> User:
    return request.state.user


# ---- Chat ----


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    messages = body.get("messages", [])

    last_user_msg = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            parts = msg.get("parts", [])
            for part in parts:
                if part.get("type") == "text":
                    last_user_msg = part["text"]
                    break
            if not last_user_msg:
                last_user_msg = msg.get("content", "")
            break

    async def generate():
        response = (
            f"You said: {last_user_msg}\n\n"
            "This is a mock response from the LifeInk AI backend. "
            "Replace this with your LLM provider integration."
        )
        for char in response:
            yield char
            await asyncio.sleep(0.02)

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
    )


# ---- Platform Binding ----

PLATFORMS = supported_platforms()

_PLATFORM_NAME_TO_ID = {"douban": PLATFORM_DOUBAN, "weread": PLATFORM_WEREAD}


def _get_manager(platform: str, db: AsyncSession, user_id: int):
    if platform == "weread":
        return WereadBindManager(db, user_id)
    return DoubanBindManager(db, user_id)


@app.post("/api/community/bind")
async def community_bind(
    request: Request,
    action: str = Query(...),
    platform: str = Query(...),
    db: AsyncSession = Depends(get_session),
):
    if platform not in PLATFORMS:
        return {"error": f"Unsupported platform: {platform}"}
    if action not in ("status", "start", "refresh", "delete"):
        return {"error": f"Unsupported action: {action}"}
    user = _user(request)
    mgr = _get_manager(platform, db, user.id)
    if action == "status":
        return await mgr.status()
    if action == "start":
        task = mgr.start_bind()
        return {"task_id": task.task_id}
    if action == "refresh":
        return await mgr.refresh()
    if action == "delete":
        return await mgr.unbind()


@app.post("/api/community/sync")
async def community_sync(
    request: Request,
    platform: str = Query(...),
    db: AsyncSession = Depends(get_session),
):
    if platform not in PLATFORMS:
        return {"error": f"Unsupported platform: {platform}"}
    user = _user(request)
    platform_id = _PLATFORM_NAME_TO_ID.get(platform, 0)
    row = await CommunityMetaRepo.get_binding(db, user.id, platform_id)
    if row is None or not row.bound or not row.community_user_id:
        return {"error": "Not bound"}
    mgr = _get_manager(platform, db, user.id)
    task = mgr.start_sync(row.community_user_id)
    return {"task_id": task.task_id}


@app.websocket("/api/community/ws")
async def community_ws(ws: WebSocket, platform: str = Query(...), token: str = Query(...)):
    try:
        payload = decode_access_token(token)
        user_pk = payload["pk"]
    except Exception:
        await ws.close(code=4001)
        return

    await ws.accept()
    if platform not in PLATFORMS:
        await ws.send_json({"status": "failed", "error": f"Unsupported platform: {platform}"})
        await ws.close()
        return

    async with async_session_factory() as db:
        user = await AuthRepo.get_user_by_pk(db, user_pk)
        if not user or user.status != "active":
            await ws.close(code=4001)
            return
        mgr = _get_manager(platform, db, user.id)

        try:
            while True:
                task = next((t for t in mgr._tasks.values() if t.status != "idle"), None)
                if task is None:
                    await ws.send_json({"status": "idle"})
                    await asyncio.sleep(1)
                    continue

                result: dict = {"status": task.status}
                if task.qr_base64:
                    result["qr_base64"] = task.qr_base64
                if task.status == "scraping":
                    result["scrape_phase"] = task.scrape_phase
                    result["scrape_counts"] = task.scrape_counts
                if task.status == "bound":
                    result["user_id"] = task.user_id
                    if task.profile:
                        result["profile"] = task.profile.model_dump()
                    result["scrape_counts"] = task.scrape_counts
                if task.status == "failed":
                    result["error"] = task.error
                await ws.send_json(result)

                if task.status in ("bound", "failed"):
                    await ws.close()
                    return

                await task.event.wait()
        except WebSocketDisconnect:
            pass


# ---- Community Data ----


@app.get("/api/community/data")
async def community_data(
    request: Request,
    platform: str = Query(default="douban"),
    db: AsyncSession = Depends(get_session),
):
    if platform not in PLATFORMS:
        return {"error": f"Unsupported platform: {platform}"}
    user = _user(request)

    if platform == "weread":
        all_books = await DataRepo.get_books(db, user.id)
        books = [row.to_api_dict() for row in all_books if row.platform_id == PLATFORM_WEREAD]
        bookmarks = [row.to_api_dict() for row in await BookmarkRepo.get_bookmarks(db, user.id)]
        return {"books": books, "bookmarks": bookmarks}

    all_books = await DataRepo.get_books(db, user.id)
    books = [row.to_api_dict() for row in all_books if row.platform_id == PLATFORM_DOUBAN]
    movies = [row.to_api_dict() for row in await DataRepo.get_movies(db, user.id)]
    notes = [row.to_api_dict() for row in await DataRepo.get_notes(db, user.id)]
    return {"books": books, "movies": movies, "notes": notes}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
