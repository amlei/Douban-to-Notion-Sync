from __future__ import annotations

import asyncio
import base64
import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from src.community.flomo.client import FlomoClient
from src.community.flomo.models import Profile as FlomoProfile
from src.community.flomo.session import SessionManager
from db.repository import CommunityMetaRepo, DataRepo
from db.engine import async_session_factory
from db.models import PLATFORM_FLOMO

log = logging.getLogger("flomo")


@dataclass
class FlomoBindTask:
    task_id: str
    platform: str = "flomo"
    status: Literal["pending", "scanned", "logged_in", "fetching_profile", "scraping", "bound", "failed"] = "pending"
    qr_base64: str | None = None
    user_id: str | None = None
    profile: dict | None = None
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


class FlomoBindManager:
    """Manages Flomo platform binding lifecycle."""

    _tasks_by_user: dict[int, dict[str, FlomoBindTask]] = {}

    def __init__(self, db: AsyncSession, user_id: int) -> None:
        self._db = db
        self._user_id = user_id
        if user_id not in FlomoBindManager._tasks_by_user:
            FlomoBindManager._tasks_by_user[user_id] = {}
        self._tasks = FlomoBindManager._tasks_by_user[user_id]

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
                        result["profile"] = task.profile
                    result["scrape_counts"] = task.scrape_counts
                if task.status == "failed":
                    result["error"] = task.error
                return result
        row = await CommunityMetaRepo.get_binding(self._db, self._user_id, PLATFORM_FLOMO)
        if row is not None and row.bound:
            return {"status": "bound", **row.to_api_dict()}
        return {"status": "idle"}

    async def refresh(self) -> dict:
        row = await CommunityMetaRepo.get_binding(self._db, self._user_id, PLATFORM_FLOMO)
        if row is None or not row.bound:
            return {"error": "Not bound"}
        try:
            state_json, _ = await CommunityMetaRepo.get_session_state(
                self._db, self._user_id, PLATFORM_FLOMO
            )
            client = FlomoClient(headless=True, state_json=state_json)
            client.__enter__()
            client.ensure_ready()
            client.__exit__(None, None, None)
        except Exception as e:
            return {"error": str(e)}
        profile = {"user_id": row.community_user_id, "name": "flomo"}
        await CommunityMetaRepo.save_binding(
            self._db, self._user_id, PLATFORM_FLOMO, row.community_user_id, profile
        )
        await self._db.commit()
        return {
            "bound": True,
            "platform_id": PLATFORM_FLOMO,
            "user_id": row.community_user_id,
            "profile": profile,
        }

    async def unbind(self) -> dict:
        await CommunityMetaRepo.delete_binding(self._db, self._user_id, PLATFORM_FLOMO)
        await self._db.commit()
        self._tasks.clear()
        return {"bound": False}

    def start_sync(self, community_user_id: str) -> FlomoBindTask:
        self._tasks.clear()
        task_id = uuid.uuid4().hex[:12]
        task = FlomoBindTask(task_id=task_id, status="scraping")
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

    def start_bind(self, channel: str = "msedge") -> FlomoBindTask:
        self._tasks.clear()
        task_id = uuid.uuid4().hex[:12]
        task = FlomoBindTask(task_id=task_id)
        task.bind_loop()
        self._tasks[task_id] = task

        db = self._db
        user_id = self._user_id
        loop = asyncio.get_running_loop()

        def _run() -> None:
            client = None
            try:
                saved_state: str | None = None

                def _on_save_state(state_json: str) -> None:
                    nonlocal saved_state
                    saved_state = state_json

                client = FlomoClient(
                    headless=False,
                    channel=channel,
                    on_progress=lambda s: (
                        setattr(task, "status", s) or task._notify()
                    ),
                    on_qr=lambda qr_bytes: (
                        setattr(task, "qr_base64", base64.b64encode(qr_bytes).decode())
                        or task._notify()
                    ),
                    on_save_state=_on_save_state,
                )

                client.__enter__()
                client.ensure_ready()
                log.info("[bind] Login done, session valid=%s", client.session.has_valid_session)

                # Use a deterministic user_id from cookie state
                user_id_str = _extract_user_id(client.session) or uuid.uuid4().hex[:8]
                log.info("[bind] Extracted user_id=%s", user_id_str)
                task.user_id = user_id_str
                task.status = "fetching_profile"
                task._notify()

                profile = {"user_id": user_id_str, "name": "flomo"}
                task.profile = profile

                # Save binding + session state to DB
                state_json = saved_state or client.session._state_json
                future = asyncio.run_coroutine_threadsafe(
                    _save_binding(db, user_id, user_id_str, profile, state_json),
                    loop,
                )
                future.result(timeout=10)

                # Auto-scrape memos
                _run_sync(task, loop, user_id, user_id_str, client)

                task.status = "bound"
                task._notify()
            except Exception as e:
                log.exception("[bind] Error during binding")
                task.status = "failed"
                task.error = str(e)
                task._notify()
            finally:
                if client:
                    try:
                        client.__exit__(None, None, None)
                    except Exception:
                        pass

        asyncio.get_event_loop().run_in_executor(None, _run)
        return task


async def _save_binding(
    db: AsyncSession,
    user_id: int,
    community_user_id: str,
    profile: dict,
    state_json: str | None,
) -> None:
    wrapper = FlomoProfile(user_id=community_user_id, name=profile.get("name"), avatar=None)
    await CommunityMetaRepo.save_binding(
        db, user_id, PLATFORM_FLOMO, community_user_id, wrapper
    )
    if state_json:
        await CommunityMetaRepo.save_session_state(db, user_id, PLATFORM_FLOMO, state_json, None)
    await db.commit()


def _extract_user_id(session: SessionManager) -> str | None:
    """Extract a user identifier from the Flomo localStorage 'me' entry."""
    if not session._state_json:
        return None
    try:
        data = json.loads(session._state_json)
    except (json.JSONDecodeError, OSError):
        return None
    from src.community.flomo.session import _find_me_in_state
    me = _find_me_in_state(data)
    if me and me.get("id"):
        return str(me["id"])
    return None


def _run_sync(
    task: FlomoBindTask,
    loop: asyncio.AbstractEventLoop,
    user_id: int,
    community_user_id: str,
    existing_client: FlomoClient | None = None,
) -> None:
    """Run Flomo sync in executor thread: export notes -> parse -> upsert."""

    client = existing_client
    should_close = False
    if client is None:
        log.info("[sync] Fetching session state from DB for user=%s", user_id)
        async def _get_state():
            async with async_session_factory() as db:
                return await CommunityMetaRepo.get_session_state(db, user_id, PLATFORM_FLOMO)

        future = asyncio.run_coroutine_threadsafe(_get_state(), loop)
        state_json, _ = future.result(timeout=10)
        if not state_json:
            log.warning("[sync] No session state found in DB, aborting")
            return
        log.info("[sync] Session state loaded, has_valid_session=%s",
                 SessionManager(state_json=state_json).has_valid_session)

        client = FlomoClient(headless=False, state_json=state_json)
        client.__enter__()
        client.ensure_ready()
        should_close = True

    try:
        task.scrape_phase = "memos"
        task._notify()
        log.info("[sync] Calling export_notes(), session valid=%s, page=%s",
                 client.session.has_valid_session, client._page is not None)

        memos = client.export_notes()
        log.info("[sync] export_notes() returned %d memos", len(memos))

        async def _save_memos(memos_arg):
            async with async_session_factory() as db:
                result = await DataRepo.upsert_flomo_memos(db, user_id, memos_arg)
                await db.commit()
                return result

        future = asyncio.run_coroutine_threadsafe(_save_memos(memos), loop)
        result = future.result(timeout=30)
        task.scrape_counts["memos_total"] = result["total"]
        task.scrape_counts["memos_updated"] = result["updated"]
        task.scrape_counts["memos_unchanged"] = result["unchanged"]
        log.info("[sync] Saved to DB: total=%d, updated=%d, unchanged=%d",
                 result["total"], result["updated"], result["unchanged"])
        task._notify()
    except Exception as e:
        log.exception("[sync] Error during sync")
        raise
    finally:
        if should_close:
            client.__exit__(None, None, None)
