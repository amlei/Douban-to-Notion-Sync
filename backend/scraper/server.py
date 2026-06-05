"""Python scraper HTTP microservice for LifeInk AI.

Runs on :50051 (internal only). Provides SSE-streamed bind/sync/refresh endpoints.
No database access - returns scraped data as JSON via SSE events.

Uses multiprocessing (not threads) to run Playwright sync code in isolated
processes, avoiding the "Sync API inside asyncio loop" error on Playwright >=1.40.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import multiprocessing as mp
import queue
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

# Ensure community package is importable (e.g. `from community.douban.client import ...`)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

log = logging.getLogger("scraper")

# Platform constants
PLATFORM_DOUBAN = 1
PLATFORM_WEREAD = 2
PLATFORM_FLOMO = 3


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
    log.info("Scraper service started on :50051")
    yield


app = FastAPI(lifespan=lifespan)


# ---- SSE Helpers ----


def sse_event(event: str, data: Any) -> str:
    payload = json.dumps(data, ensure_ascii=False) if isinstance(data, dict) else str(data)
    return f"event: {event}\ndata: {payload}\n\n"


# ---- Subprocess drain helpers ----


async def _drain_process_events(eq: mp.Queue, p: mp.Process, task_id: str | None = None):
    """Drain SSE events from a subprocess mp.Queue and yield them as SSE strings.

    The subprocess puts (event_name, data) tuples into eq.
    Terminates the process if still alive after draining.
    """
    try:
        while True:
            got_event = False
            while True:
                try:
                    event_name, data = eq.get_nowait()
                except queue.Empty:
                    break
                got_event = True

                if event_name == "done":
                    yield sse_event("done", data)
                    return
                if event_name == "error":
                    yield sse_event("error", data if isinstance(data, dict) else {"error": data})
                    return
                # Inject task_id into progress events for bind flows
                if event_name == "progress" and task_id and isinstance(data, dict):
                    data.setdefault("task_id", task_id)
                yield sse_event(event_name, data)

            if not p.is_alive() and not got_event:
                yield sse_event("error", {"error": "Process terminated unexpectedly"})
                return

            await asyncio.sleep(0.3)
    finally:
        p.join(timeout=5)
        if p.is_alive():
            p.terminate()
            p.join()


async def _run_subprocess_single(target, args_tuple):
    """Run a subprocess that returns a single (tag, data) result via mp.Queue."""
    eq = mp.Queue()
    p = mp.Process(target=target, args=(eq,) + args_tuple)
    p.start()

    try:
        while True:
            try:
                tag, data = eq.get_nowait()
                break
            except queue.Empty:
                pass
            if not p.is_alive():
                try:
                    tag, data = eq.get_nowait()
                    break
                except queue.Empty:
                    return {"error": "Process terminated unexpectedly"}
            await asyncio.sleep(0.3)
    finally:
        p.join(timeout=5)
        if p.is_alive():
            p.terminate()
            p.join()

    if tag in ("result", "error"):
        return data
    return {"error": "Unexpected response from subprocess"}


# ---- Endpoints ----


@app.post("/bind")
async def bind(request: Request):
    """Start platform binding (QR login + initial sync). Returns SSE stream."""
    body = await request.json()
    platform = body.get("platform", "")
    user_id = body.get("user_id", 0)
    channel = body.get("channel", "msedge")

    if platform == "douban":
        return StreamingResponse(
            _bind_douban(user_id, channel),
            media_type="text/event-stream",
        )
    if platform == "weread":
        return StreamingResponse(
            _bind_weread(user_id, channel),
            media_type="text/event-stream",
        )
    if platform == "flomo":
        return StreamingResponse(
            _bind_flomo(user_id, channel),
            media_type="text/event-stream",
        )
    return {"error": f"Unsupported platform: {platform}"}


@app.post("/sync")
async def sync(request: Request):
    """Data sync for bound platform. Returns SSE stream."""
    body = await request.json()
    platform = body.get("platform", "")
    user_id = body.get("user_id", 0)
    session_state_json = body.get("session_state_json", "")
    community_user_id = body.get("community_user_id", "")
    existing_book_urls = body.get("existing_book_urls", [])
    existing_movie_urls = body.get("existing_movie_urls", [])
    bookmark_synckeys = body.get("bookmark_synckeys", {})

    if platform == "weread":
        return StreamingResponse(
            _sync_weread(user_id, session_state_json, community_user_id, bookmark_synckeys),
            media_type="text/event-stream",
        )
    if platform == "flomo":
        return StreamingResponse(
            _sync_flomo(user_id, session_state_json, community_user_id),
            media_type="text/event-stream",
        )
    return {"error": f"Unsupported platform: {platform}"}


@app.post("/refresh")
async def refresh(request: Request):
    """Refresh profile for bound platform."""
    body = await request.json()
    platform = body.get("platform", "")
    session_state_json = body.get("session_state_json", "")

    if platform == "weread":
        return await _refresh_weread(session_state_json)
    if platform == "flomo":
        return await _refresh_flomo(session_state_json)
    return {"error": f"Unsupported platform: {platform}"}


@app.post("/unbind")
async def unbind(request: Request):
    """Logout from platform before unbinding."""
    body = await request.json()
    platform = body.get("platform", "")
    session_state_json = body.get("session_state_json", "")

    if platform == "flomo" and session_state_json:
        p = mp.Process(target=_logout_flomo_subprocess, args=(session_state_json,))
        p.start()
        while p.is_alive():
            await asyncio.sleep(0.5)
        p.join()

    return {"status": "ok"}


@app.get("/health")
async def health():
    return {"status": "ok"}


# ---- Douban subprocess functions (module-level for macOS spawn) ----


def _bind_douban_subprocess(eq: mp.Queue, user_id: int, channel: str):
    from community.douban.client import DoubanClient
    from community.douban.session import SessionManager
    from community.douban.scrapers.books import BooksScraper
    from community.douban.scrapers.movies import MoviesScraper

    def capture_qr(data_bytes):
        eq.put(("progress", {
            "status": "pending",
            "qr_base64": f"data:image/png;base64,{base64.b64encode(data_bytes).decode()}",
        }))

    def capture_progress(status):
        eq.put(("progress", {"status": status}))

    client = DoubanClient(
        headless=False,
        channel=channel,
        on_qr=capture_qr,
        on_progress=capture_progress,
    )
    client.__enter__()
    try:
        client.ensure_ready()
    except Exception as e:
        eq.put(("error", {"error": str(e)}))
        try:
            client.__exit__(None, None, None)
        except Exception:
            pass
        return

    try:
        eq.put(("progress", {"status": "logged_in"}))
        eq.put(("progress", {"status": "fetching_profile"}))

        profile = client.scrape_profile()
        state_json = client._session._state_json
        community_user_id = client.user_id

        eq.put(("bound", {
            "community_user_id": community_user_id,
            "profile_json": profile.model_dump_json(),
            "session_state_json": state_json or "",
            "session_expires_at": _extract_dbcl2_expiry(state_json) if state_json else "",
        }))

        # Close browser -- douban auto-scrape uses requests, not Playwright
        client.__exit__(None, None, None)

        # Auto-scrape
        counts = {}
        if state_json:
            mgr = SessionManager(state_json=state_json)
            http = mgr.build_http_session()
            try:
                eq.put(("scraping", {"phase": "books", "counts": {}}))
                books = BooksScraper(http, community_user_id).scrape(max_pages=0)
                if books:
                    eq.put(("data", {"type": "book", "items": [b.model_dump() for b in books]}))
                    counts["books"] = len(books)

                eq.put(("scraping", {"phase": "movies", "counts": counts}))
                movies = MoviesScraper(http, community_user_id).scrape(max_pages=0)
                if movies:
                    eq.put(("data", {"type": "movie", "items": [m.model_dump() for m in movies]}))
                    counts["movies"] = len(movies)
            finally:
                http.close()

        eq.put(("done", {"counts": counts}))
    except Exception as e:
        log.exception("[bind/douban] Error in subprocess")
        eq.put(("error", {"error": str(e)}))
        try:
            client.__exit__(None, None, None)
        except Exception:
            pass


# ---- WeRead subprocess functions (module-level for macOS spawn) ----


def _bind_weread_subprocess(eq: mp.Queue, user_id: int, channel: str):
    from community.weread.client import WeReadClient
    from community.weread.scrapers.shelf import scrape_shelf
    from community.weread.scrapers.bookmarks import scrape_bookmarks

    def capture_qr(data_bytes):
        eq.put(("progress", {
            "status": "pending",
            "qr_base64": f"data:image/png;base64,{base64.b64encode(data_bytes).decode()}",
        }))

    def capture_progress(status):
        eq.put(("progress", {"status": status}))

    client = WeReadClient(
        headless=False,
        channel=channel,
        on_qr=capture_qr,
        on_progress=capture_progress,
    )
    client.__enter__()
    try:
        client.ensure_ready()
    except Exception as e:
        eq.put(("error", {"error": str(e)}))
        try:
            client.__exit__(None, None, None)
        except Exception:
            pass
        return

    try:
        eq.put(("progress", {"status": "logged_in"}))
        eq.put(("progress", {"status": "fetching_profile"}))

        profile = client.scrape_profile()
        vid = client.vid
        state_json = client._session._state_json

        eq.put(("bound", {
            "community_user_id": vid,
            "profile_json": profile.model_dump_json(),
            "session_state_json": state_json or "",
        }))

        # Auto-scrape
        counts = {}

        eq.put(("scraping", {"phase": "books", "counts": {}}))
        books = scrape_shelf(client._page, vid)
        if books:
            eq.put(("data", {"type": "book", "items": [b.model_dump() for b in books]}))
            counts["books"] = len(books)

        eq.put(("scraping", {"phase": "bookmarks", "counts": counts}))
        book_ids = [b.book_id for b in books] if books else []
        all_bookmarks = []
        for book_id in book_ids[:50]:
            bms, _ = scrape_bookmarks(client._page, book_id, 0)
            if bms:
                all_bookmarks.extend(bms)
        if all_bookmarks:
            eq.put(("data", {"type": "bookmark", "items": [b.model_dump() for b in all_bookmarks]}))
            counts["bookmarks"] = len(all_bookmarks)

        eq.put(("done", {"counts": counts}))
    except Exception as e:
        log.exception("[bind/weread] Error in subprocess")
        eq.put(("error", {"error": str(e)}))
    finally:
        try:
            client.__exit__(None, None, None)
        except Exception:
            pass


def _sync_weread_subprocess(eq: mp.Queue, user_id, session_state_json, community_user_id, bookmark_synckeys):
    from community.weread.client import WeReadClient
    from community.weread.scrapers.shelf import scrape_shelf
    from community.weread.scrapers.bookmarks import scrape_bookmarks

    if not session_state_json:
        eq.put(("error", {"error": "No session state"}))
        return

    client = None
    try:
        client = WeReadClient(headless=True, state_json=session_state_json)
        client.__enter__()
        client.ensure_ready()

        counts = {}

        eq.put(("progress", {"status": "scraping", "phase": "books"}))
        books = scrape_shelf(client._page, community_user_id)
        if books:
            eq.put(("data", {"type": "book", "items": [b.model_dump() for b in books]}))
            counts["books"] = len(books)

        eq.put(("progress", {"status": "scraping", "phase": "bookmarks"}))
        book_ids = [b.book_id for b in books] if books else []
        all_bookmarks = []
        new_synckeys = {}
        for book_id in book_ids[:50]:
            last_synckey = bookmark_synckeys.get(book_id, 0)
            bms, new_sk = scrape_bookmarks(client._page, book_id, last_synckey)
            if bms:
                all_bookmarks.extend(bms)
            if new_sk != last_synckey:
                new_synckeys[book_id] = new_sk

        if all_bookmarks:
            eq.put(("data", {"type": "bookmark", "items": [b.model_dump() for b in all_bookmarks]}))
        if new_synckeys:
            eq.put(("data", {"type": "synckeys", "synckeys": new_synckeys}))
        counts["bookmarks"] = len(all_bookmarks)

        eq.put(("done", {"counts": counts}))
    except Exception as e:
        log.exception("[sync/weread] Error in subprocess")
        eq.put(("error", {"error": str(e)}))
    finally:
        if client:
            try:
                client.__exit__(None, None, None)
            except Exception:
                pass


def _refresh_weread_subprocess(eq: mp.Queue, session_state_json: str):
    from community.weread.client import WeReadClient

    client = None
    try:
        client = WeReadClient(headless=True, state_json=session_state_json)
        client.__enter__()
        client.ensure_ready()
        profile = client.scrape_profile()
        vid = client.vid
        eq.put(("result", {
            "community_user_id": vid,
            "profile_json": profile.model_dump_json(),
        }))
    except Exception as e:
        eq.put(("error", {"error": str(e)}))
    finally:
        if client:
            try:
                client.__exit__(None, None, None)
            except Exception:
                pass


# ---- Flomo subprocess functions (module-level for macOS spawn) ----


def _bind_flomo_subprocess(eq: mp.Queue, user_id: int, channel: str):
    from community.flomo.client import FlomoClient
    from community.flomo.session import extract_profile_from_state

    saved_state = None

    def capture_qr(data_bytes):
        eq.put(("progress", {
            "status": "pending",
            "qr_base64": f"data:image/png;base64,{base64.b64encode(data_bytes).decode()}",
        }))

    def capture_progress(status):
        eq.put(("progress", {"status": status}))

    def on_save_state(s):
        nonlocal saved_state
        saved_state = s

    client = FlomoClient(
        headless=False,
        channel=channel,
        on_qr=capture_qr,
        on_progress=capture_progress,
        on_save_state=on_save_state,
    )
    client.__enter__()
    try:
        client.ensure_ready()
    except Exception as e:
        eq.put(("error", {"error": str(e)}))
        try:
            client.__exit__(None, None, None)
        except Exception:
            pass
        return

    try:
        eq.put(("progress", {"status": "logged_in"}))
        eq.put(("progress", {"status": "fetching_profile"}))

        user_id_str = _extract_flomo_user_id(client.session) or uuid.uuid4().hex[:8]
        state_json = saved_state or client.session._state_json

        profile = extract_profile_from_state(state_json)
        if profile is None:
            profile = {"user_id": user_id_str, "name": "flomo"}
        else:
            profile.setdefault("user_id", user_id_str)

        expires_at = _extract_flomo_expires(state_json)

        eq.put(("bound", {
            "community_user_id": user_id_str,
            "profile_json": json.dumps(profile, ensure_ascii=False),
            "session_state_json": state_json or "",
            "session_expires_at": expires_at,
        }))

        # Auto-scrape memos -- download zip, Go backend parses it
        eq.put(("scraping", {"phase": "memos", "counts": {}}))

        def on_export_progress(status):
            eq.put(("scraping", {"phase": status, "counts": {}}))

        client._on_progress = on_export_progress
        zip_path = client.download_export()

        eq.put(("done", {"zip_path": str(zip_path)}))
    except Exception as e:
        log.exception("[bind/flomo] Error in subprocess")
        eq.put(("error", {"error": str(e)}))
    finally:
        try:
            client.__exit__(None, None, None)
        except Exception:
            pass


def _sync_flomo_subprocess(eq: mp.Queue, user_id, session_state_json, community_user_id):
    from community.flomo.client import FlomoClient

    if not session_state_json:
        eq.put(("error", {"error": "No session state"}))
        return

    client = None
    try:
        client = FlomoClient(headless=False, state_json=session_state_json)
        client.__enter__()
        client.ensure_ready()

        eq.put(("progress", {"status": "scraping", "phase": "memos"}))
        zip_path = client.download_export()

        eq.put(("done", {"zip_path": str(zip_path)}))
    except Exception as e:
        log.exception("[sync/flomo] Error in subprocess")
        eq.put(("error", {"error": str(e)}))
    finally:
        if client:
            try:
                client.__exit__(None, None, None)
            except Exception:
                pass


def _refresh_flomo_subprocess(eq: mp.Queue, session_state_json: str):
    from community.flomo.client import FlomoClient
    from community.flomo.session import extract_profile_from_state

    client = None
    try:
        client = FlomoClient(headless=True, state_json=session_state_json)
        client.__enter__()
        client.ensure_ready()
        user_id_str = _extract_flomo_user_id(client.session) or "unknown"
        state_json_val = client.session._state_json
        profile = extract_profile_from_state(state_json_val)
        if profile is None:
            profile = {"user_id": user_id_str, "name": "flomo"}
        else:
            profile.setdefault("user_id", user_id_str)
        eq.put(("result", {
            "community_user_id": user_id_str,
            "profile_json": json.dumps(profile, ensure_ascii=False),
        }))
    except Exception as e:
        eq.put(("error", {"error": str(e)}))
    finally:
        if client:
            try:
                client.__exit__(None, None, None)
            except Exception:
                pass


def _logout_flomo_subprocess(session_state_json: str):
    """Open browser and click logout on flomo."""
    from community.flomo.client import FlomoClient
    from community.flomo import BASE_URL

    client = None
    try:
        client = FlomoClient(headless=True, state_json=session_state_json)
        client.__enter__()
        client._start_browser()
        page = client._page
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")

        menu_trigger = page.locator("div.menu-trigger-content").first
        menu_trigger.click()
        page.wait_for_timeout(1000)

        logout_item = page.get_by_text("退出", exact=True).last
        logout_item.click()
        page.wait_for_timeout(2000)
        log.info("[unbind/flomo] Logged out successfully")
    except Exception as e:
        log.warning("[unbind/flomo] Logout failed: %s", e)
    finally:
        if client:
            try:
                client.__exit__(None, None, None)
            except Exception:
                pass


# ---- Douban async generators ----


async def _bind_douban(user_id: int, channel: str):
    task_id = uuid.uuid4().hex[:12]
    yield sse_event("progress", {"task_id": task_id, "status": "pending"})

    eq = mp.Queue()
    p = mp.Process(target=_bind_douban_subprocess, args=(eq, user_id, channel))
    p.start()

    async for event in _drain_process_events(eq, p, task_id):
        yield event


# ---- WeRead async generators ----


async def _bind_weread(user_id: int, channel: str):
    task_id = uuid.uuid4().hex[:12]
    yield sse_event("progress", {"task_id": task_id, "status": "pending"})

    eq = mp.Queue()
    p = mp.Process(target=_bind_weread_subprocess, args=(eq, user_id, channel))
    p.start()

    async for event in _drain_process_events(eq, p, task_id):
        yield event


async def _sync_weread(user_id, session_state_json, community_user_id, bookmark_synckeys):
    if not session_state_json:
        yield sse_event("error", {"error": "No session state"})
        return

    eq = mp.Queue()
    p = mp.Process(
        target=_sync_weread_subprocess,
        args=(eq, user_id, session_state_json, community_user_id, bookmark_synckeys),
    )
    p.start()

    async for event in _drain_process_events(eq, p):
        yield event


async def _refresh_weread(session_state_json: str):
    return await _run_subprocess_single(_refresh_weread_subprocess, (session_state_json,))


# ---- Flomo async generators ----


async def _bind_flomo(user_id: int, channel: str):
    task_id = uuid.uuid4().hex[:12]
    yield sse_event("progress", {"task_id": task_id, "status": "pending"})

    eq = mp.Queue()
    p = mp.Process(target=_bind_flomo_subprocess, args=(eq, user_id, channel))
    p.start()

    async for event in _drain_process_events(eq, p, task_id):
        yield event


async def _sync_flomo(user_id, session_state_json, community_user_id):
    if not session_state_json:
        yield sse_event("error", {"error": "No session state"})
        return

    eq = mp.Queue()
    p = mp.Process(
        target=_sync_flomo_subprocess,
        args=(eq, user_id, session_state_json, community_user_id),
    )
    p.start()

    async for event in _drain_process_events(eq, p):
        yield event


async def _refresh_flomo(session_state_json: str):
    return await _run_subprocess_single(_refresh_flomo_subprocess, (session_state_json,))


# ---- Helpers ----


def _extract_dbcl2_expiry(state_json: str) -> str | None:
    try:
        data = json.loads(state_json)
        for cookie in data.get("cookies", []):
            if cookie.get("name") == "dbcl2":
                return str(cookie.get("expires", -1))
    except (json.JSONDecodeError, OSError):
        pass
    return None


def _extract_flomo_user_id(session) -> str | None:
    if not session._state_json:
        return None
    try:
        data = json.loads(session._state_json)
    except (json.JSONDecodeError, OSError):
        return None
    from community.flomo.session import _find_me_in_state
    me = _find_me_in_state(data)
    if me and me.get("id"):
        return str(me["id"])
    return None


def _extract_flomo_expires(state_json: str | None) -> str:
    """Extract token expires_at from flomo 'me' localStorage object."""
    if not state_json:
        return ""
    try:
        data = json.loads(state_json)
    except (json.JSONDecodeError, OSError):
        return ""
    from community.flomo.session import _find_me_in_state
    me = _find_me_in_state(data)
    if me and me.get("expires_at"):
        return str(me["expires_at"])
    return ""


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=50051)
