from __future__ import annotations

import asyncio
import base64
import json
import uuid
from dataclasses import dataclass, field
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from src.community.douban.client import DoubanClient
from src.community.douban.models.profile import Profile
from src.community.douban.session import SessionManager
from db.models import PLATFORM_DOUBAN
from db.repository import CommunityMetaRepo, DataRepo
from db.engine import async_session_factory


@dataclass
class BindTask:
    task_id: str
    platform: str
    status: Literal["pending", "scanned", "logged_in", "fetching_profile", "scraping", "bound", "failed"] = "pending"
    qr_base64: str | None = None
    user_id: str | None = None
    profile: Profile | None = None
    error: str | None = None
    scrape_phase: str | None = None
    scrape_counts: dict = field(default_factory=dict)
    event: asyncio.Event = field(default_factory=asyncio.Event)
    _loop: asyncio.AbstractEventLoop | None = field(default=None, repr=False)

    def bind_loop(self) -> None:
        self._loop = asyncio.get_running_loop()

    def _notify(self) -> None:
        if self._loop is None:
            return
        self._loop.call_soon_threadsafe(self._set_and_clear)

    def _set_and_clear(self) -> None:
        self.event.set()
        self.event.clear()


class AsyncBindManager:
    """Manages platform binding lifecycle with database-backed storage."""

    _tasks_by_user: dict[int, dict[str, BindTask]] = {}

    def __init__(self, db: AsyncSession, user_id: int) -> None:
        self._db = db
        self._user_id = user_id
        if user_id not in AsyncBindManager._tasks_by_user:
            AsyncBindManager._tasks_by_user[user_id] = {}
        self._tasks = AsyncBindManager._tasks_by_user[user_id]

    async def status(self) -> dict:
        for task in self._tasks.values():
            if task.status in ("pending", "scraping", "bound", "failed"):
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
                return result
        row = await CommunityMetaRepo.get_binding(self._db, self._user_id, PLATFORM_DOUBAN)
        if row is not None and row.bound:
            return {"status": "bound", **row.to_api_dict()}
        return {"status": "idle"}

    async def refresh(self) -> dict:
        row = await CommunityMetaRepo.get_binding(self._db, self._user_id, PLATFORM_DOUBAN)
        if row is None or not row.bound:
            return {"error": "Not bound"}
        if not row.community_user_id:
            return {"error": "No user_id in meta"}
        try:
            state_json, _ = await CommunityMetaRepo.get_session_state(
                self._db, self._user_id, PLATFORM_DOUBAN
            )
            mgr = SessionManager(state_json=state_json)
            http = mgr.build_http_session()
            from src.community.douban.scrapers.profile import ProfileScraper

            profile = ProfileScraper(http, row.community_user_id).scrape()
            http.close()
        except Exception as e:
            return {"error": str(e)}
        await CommunityMetaRepo.save_binding(
            self._db, self._user_id, PLATFORM_DOUBAN, row.community_user_id, profile
        )
        await self._db.commit()
        return {
            "bound": True,
            "platform": "douban",
            "user_id": row.community_user_id,
            "profile": profile.model_dump(),
        }

    async def unbind(self) -> dict:
        await CommunityMetaRepo.delete_binding(self._db, self._user_id, PLATFORM_DOUBAN)
        await self._db.commit()
        self._tasks.clear()
        return {"bound": False}

    def start_sync(self, community_user_id: str) -> BindTask:
        self._tasks.clear()
        task_id = uuid.uuid4().hex[:12]
        task = BindTask(task_id=task_id, platform="douban", status="scraping")
        task.bind_loop()
        self._tasks[task_id] = task

        user_id = self._user_id
        loop = asyncio.get_running_loop()

        def _run() -> None:
            try:
                _run_sync(task, loop, user_id, community_user_id)
                task.status = "bound"
                task._notify()
            except Exception as e:
                task.status = "failed"
                task.error = str(e)
                task._notify()

        loop.run_in_executor(None, _run)
        task._notify()
        return task

    def start_bind(self, channel: str = "msedge") -> BindTask:
        self._tasks.clear()
        task_id = uuid.uuid4().hex[:12]
        task = BindTask(task_id=task_id, platform="douban")
        task.bind_loop()
        self._tasks[task_id] = task

        db = self._db
        user_id = self._user_id
        loop = asyncio.get_running_loop()

        def _run() -> None:
            try:
                client = DoubanClient(
                    headless=False,
                    channel=channel,
                    on_progress=lambda s: (
                        setattr(task, "status", s) or task._notify()
                    ),
                    on_qr=lambda qr_bytes: (
                        setattr(task, "qr_base64", base64.b64encode(qr_bytes).decode())
                    ),
                )

                client.__enter__()
                client.ensure_ready()

                task.user_id = client.user_id
                task.status = "fetching_profile"
                task._notify()

                task.profile = client.scrape_profile()

                # Save binding + session state to DB
                state_json = client._session._state_json
                expires_at = _extract_dbcl2_expiry(state_json) if state_json else None
                future = asyncio.run_coroutine_threadsafe(
                    _save_binding(db, user_id, client.user_id, task.profile, state_json, expires_at),
                    loop,
                )
                future.result(timeout=10)

                # Close browser — no longer needed for scraping
                client.__exit__(None, None, None)

                # Auto-scrape books and movies via sync
                _run_sync(task, loop, user_id, client.user_id)

                task.status = "bound"
                task._notify()
            except Exception as e:
                task.status = "failed"
                task.error = str(e)
                task._notify()

        asyncio.get_event_loop().run_in_executor(None, _run)
        return task


async def _save_binding(
    db: AsyncSession,
    user_id: int,
    community_user_id: str,
    profile: Profile,
    state_json: str | None,
    expires_at: str | None,
) -> None:
    row = await CommunityMetaRepo.save_binding(
        db, user_id, PLATFORM_DOUBAN, community_user_id, profile
    )
    if state_json:
        row.session_state_json = state_json
        row.session_expires_at = expires_at
    await db.commit()


def _run_sync(
    task: BindTask,
    loop: asyncio.AbstractEventLoop,
    user_id: int,
    community_user_id: str,
) -> None:
    async def _do_scrape() -> None:
        async with async_session_factory() as db:
            state_json, _ = await CommunityMetaRepo.get_session_state(db, user_id, PLATFORM_DOUBAN)
            if not state_json:
                return
            mgr = SessionManager(state_json=state_json)
            http = mgr.build_http_session()
            try:
                from src.community.douban.scrapers.books import BooksScraper
                from src.community.douban.scrapers.movies import MoviesScraper

                existing_books = {row.url for row in await DataRepo.get_books(db, user_id)}
                existing_movies = {row.url for row in await DataRepo.get_movies(db, user_id)}

                task.scrape_phase = "books"
                task._notify()
                try:
                    books = BooksScraper(http, community_user_id).scrape(max_pages=0, existing_urls=existing_books)
                    result = await DataRepo.upsert_books(db, user_id, books)
                    await db.commit()
                    task.scrape_counts["books"] = result["updated"]
                    task._notify()
                except Exception:
                    pass

                task.scrape_phase = "movies"
                task._notify()
                try:
                    movies = MoviesScraper(http, community_user_id).scrape(max_pages=0, existing_urls=existing_movies)
                    await DataRepo.upsert_movies(db, user_id, movies)
                    await db.commit()
                    task.scrape_counts["movies"] = len(movies)
                    task._notify()
                except Exception:
                    pass
            finally:
                http.close()

    future = asyncio.run_coroutine_threadsafe(_do_scrape(), loop)
    future.result(timeout=600)


def _extract_dbcl2_expiry(state_json: str) -> str | None:
    try:
        data = json.loads(state_json)
        for cookie in data.get("cookies", []):
            if cookie.get("name") == "dbcl2":
                return str(cookie.get("expires", -1))
    except (json.JSONDecodeError, OSError):
        pass
    return None


def supported_platforms() -> list[str]:
    return ["douban", "weread", "flomo"]
