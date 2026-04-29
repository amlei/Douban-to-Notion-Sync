from __future__ import annotations

import asyncio
import base64
import uuid
from dataclasses import dataclass, field
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from src.community.weread.client import WeReadClient
from src.community.weread.models.profile import Profile
from src.community.weread.session import SessionManager
from db.repository import CommunityMetaRepo, DataRepo, BookmarkRepo
from db.engine import async_session_factory
from db.models import PLATFORM_WEREAD


@dataclass
class WereadBindTask:
    task_id: str
    platform: str = "weread"
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


class WereadBindManager:
    """Manages WeRead platform binding lifecycle with database-backed storage."""

    _tasks_by_user: dict[int, dict[str, WereadBindTask]] = {}

    def __init__(self, db: AsyncSession, user_id: int) -> None:
        self._db = db
        self._user_id = user_id
        if user_id not in WereadBindManager._tasks_by_user:
            WereadBindManager._tasks_by_user[user_id] = {}
        self._tasks = WereadBindManager._tasks_by_user[user_id]

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
        row = await CommunityMetaRepo.get_binding(self._db, self._user_id, PLATFORM_WEREAD)
        if row is not None and row.bound:
            return {"status": "bound", **row.to_api_dict()}
        return {"status": "idle"}

    async def refresh(self) -> dict:
        row = await CommunityMetaRepo.get_binding(self._db, self._user_id, PLATFORM_WEREAD)
        if row is None or not row.bound:
            return {"error": "Not bound"}
        if not row.community_user_id:
            return {"error": "No user_id in meta"}
        try:
            state_json, _ = await CommunityMetaRepo.get_session_state(
                self._db, self._user_id, PLATFORM_WEREAD
            )
            client = WeReadClient(
                headless=True,
                state_json=state_json,
            )
            client.__enter__()
            client.ensure_ready()
            profile = client.scrape_profile()
            client.__exit__(None, None, None)
        except Exception as e:
            return {"error": str(e)}
        await CommunityMetaRepo.save_binding(
            self._db, self._user_id, PLATFORM_WEREAD, row.community_user_id, profile
        )
        await self._db.commit()
        return {
            "bound": True,
            "platform_id": PLATFORM_WEREAD,
            "user_id": row.community_user_id,
            "profile": profile.model_dump(),
        }

    async def unbind(self) -> dict:
        await CommunityMetaRepo.delete_binding(self._db, self._user_id, PLATFORM_WEREAD)
        await self._db.commit()
        self._tasks.clear()
        return {"bound": False}

    def start_sync(self, community_user_id: str) -> WereadBindTask:
        self._tasks.clear()
        task_id = uuid.uuid4().hex[:12]
        task = WereadBindTask(task_id=task_id, status="scraping")
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

    def start_bind(self, channel: str = "msedge") -> WereadBindTask:
        self._tasks.clear()
        task_id = uuid.uuid4().hex[:12]
        task = WereadBindTask(task_id=task_id)
        task.bind_loop()
        self._tasks[task_id] = task

        db = self._db
        user_id = self._user_id
        loop = asyncio.get_running_loop()

        def _run() -> None:
            try:
                client = WeReadClient(
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

                task.user_id = client.vid
                task.status = "fetching_profile"
                task._notify()

                task.profile = client.scrape_profile()

                # Save binding + session state to DB
                state_json = client._session._state_json
                future = asyncio.run_coroutine_threadsafe(
                    _save_binding(db, user_id, client.vid, task.profile, state_json),
                    loop,
                )
                future.result(timeout=10)

                # Auto-scrape shelf + bookmarks via sync
                _run_sync(task, loop, user_id, client.vid, client)

                task.status = "bound"
                task._notify()
            except Exception as e:
                task.status = "failed"
                task.error = str(e)
                task._notify()
            finally:
                try:
                    client.__exit__(None, None, None)
                except Exception:
                    pass

        asyncio.get_event_loop().run_in_executor(None, _run)
        return task


async def _save_binding(
    db: AsyncSession,
    user_id: int,
    vid: str,
    profile: Profile,
    state_json: str | None,
) -> None:
    await CommunityMetaRepo.save_binding(
        db, user_id, PLATFORM_WEREAD, vid, profile
    )
    if state_json:
        await CommunityMetaRepo.save_session_state(db, user_id, PLATFORM_WEREAD, state_json, None)
    await db.commit()


def _run_sync(
    task: WereadBindTask,
    loop: asyncio.AbstractEventLoop,
    user_id: int,
    vid: str,
    existing_client: WeReadClient | None = None,
) -> None:
    """Run WeRead sync in executor thread. Playwright runs sync in the thread;
    only async DB writes are dispatched to the event loop via run_coroutine_threadsafe."""

    # Step 1: Fetch session state from DB (must run on event loop)
    async def _get_state():
        async with async_session_factory() as db:
            return await CommunityMetaRepo.get_session_state(db, user_id, PLATFORM_WEREAD)

    future = asyncio.run_coroutine_threadsafe(_get_state(), loop)
    state_json, _ = future.result(timeout=10)
    if not state_json:
        return

    # Step 2: Playwright sync operations (run in executor thread, NOT on asyncio loop)
    client = existing_client
    should_close = False
    if client is None:
        client = WeReadClient(headless=True, state_json=state_json)
        client.__enter__()
        client.ensure_ready()
        should_close = True

    try:
        from src.community.weread.scrapers.shelf import scrape_shelf
        from src.community.weread.scrapers.bookmarks import scrape_bookmarks

        # Step 3: Scrape books (incremental: only upsert changed rows)
        task.scrape_phase = "books"
        task._notify()
        books = []
        try:
            books = scrape_shelf(client._page, vid)

            async def _save_books(books_arg):
                async with async_session_factory() as db:
                    result = await DataRepo.upsert_weread_books(db, user_id, books_arg)
                    await db.commit()
                    return result
            future = asyncio.run_coroutine_threadsafe(_save_books(books), loop)
            result = future.result(timeout=30)
            task.scrape_counts["books_total"] = result["total"]
            task.scrape_counts["books_updated"] = result["updated"]
            task.scrape_counts["books_unchanged"] = result["unchanged"]
            task._notify()
        except Exception:
            pass

        # Step 4: Scrape bookmarks (incremental: use synckey per book)
        task.scrape_phase = "bookmarks"
        task._notify()
        try:
            # Fetch last synckeys from DB
            async def _get_synckeys():
                async with async_session_factory() as db:
                    return await DataRepo.get_bookmark_synckeys(db, user_id)
            future = asyncio.run_coroutine_threadsafe(_get_synckeys(), loop)
            synckeys = future.result(timeout=10)

            book_ids = [b.book_id for b in books] if books else []
            all_bookmarks = []
            new_synckeys: dict[str, int] = {}
            for book_id in book_ids[:50]:
                last_synckey = synckeys.get(book_id, 0)
                bms, new_sk = scrape_bookmarks(client._page, book_id, last_synckey)
                if bms:
                    all_bookmarks.extend(bms)
                if new_sk != last_synckey:
                    new_synckeys[book_id] = new_sk

            if all_bookmarks:
                async def _save_bookmarks(bms_arg, sk_arg):
                    async with async_session_factory() as db:
                        await BookmarkRepo.upsert_bookmarks(db, user_id, bms_arg)
                        for bid, sk in sk_arg.items():
                            await DataRepo.update_bookmark_synckey(db, user_id, bid, sk)
                        await db.commit()
                future = asyncio.run_coroutine_threadsafe(
                    _save_bookmarks(all_bookmarks, new_synckeys), loop
                )
                future.result(timeout=30)
            elif new_synckeys:
                # No new bookmarks but synckey changed — still update synckeys
                async def _update_synckeys(sk_arg):
                    async with async_session_factory() as db:
                        for bid, sk in sk_arg.items():
                            await DataRepo.update_bookmark_synckey(db, user_id, bid, sk)
                        await db.commit()
                future = asyncio.run_coroutine_threadsafe(_update_synckeys(new_synckeys), loop)
                future.result(timeout=10)

            task.scrape_counts["bookmarks"] = len(all_bookmarks)
            task._notify()
        except Exception:
            pass
    finally:
        if should_close:
            client.__exit__(None, None, None)
