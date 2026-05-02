"""Python scraper HTTP microservice for LifeInk AI.

Runs on :50051 (internal only). Provides SSE-streamed bind/sync/refresh endpoints.
No database access - returns scraped data as JSON via SSE events.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
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

    if platform == "douban":
        return StreamingResponse(
            _sync_douban(user_id, session_state_json, community_user_id, existing_book_urls, existing_movie_urls),
            media_type="text/event-stream",
        )
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

    if platform == "douban":
        return await _refresh_douban(session_state_json)
    if platform == "weread":
        return await _refresh_weread(session_state_json)
    if platform == "flomo":
        return await _refresh_flomo(session_state_json)
    return {"error": f"Unsupported platform: {platform}"}


@app.get("/health")
async def health():
    return {"status": "ok"}


# ---- Douban ----


async def _bind_douban(user_id: int, channel: str):
    from community.douban.client import DoubanClient
    from community.douban.session import SessionManager

    task_id = uuid.uuid4().hex[:12]
    yield sse_event("progress", {"task_id": task_id, "status": "pending"})

    eq = queue.Queue()

    def _run():
        def capture_qr(data_bytes):
            eq.put(("qr", base64.b64encode(data_bytes).decode()))

        def capture_progress(status):
            eq.put(("status", status))

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
            eq.put(("error", str(e)))
            return
        eq.put(("done", client))

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run)

    # Drain events from the background thread and yield SSE events
    client = None
    while client is None:
        try:
            tag, data = eq.get_nowait()
        except queue.Empty:
            await asyncio.sleep(0.3)
            continue
        if tag == "qr":
            yield sse_event("progress", {"task_id": task_id, "status": "pending", "qr_base64": f"data:image/png;base64,{data}"})
        elif tag == "status":
            yield sse_event("progress", {"task_id": task_id, "status": data})
        elif tag == "error":
            yield sse_event("error", {"error": data})
            return
        elif tag == "done":
            client = data

    try:
        yield sse_event("progress", {"task_id": task_id, "status": "logged_in"})
        yield sse_event("progress", {"task_id": task_id, "status": "fetching_profile"})

        profile = await loop.run_in_executor(None, client.scrape_profile)
        state_json = client._session._state_json
        community_user_id = client.user_id

        yield sse_event("bound", {
            "community_user_id": community_user_id,
            "profile_json": profile.model_dump_json(),
            "session_state_json": state_json or "",
            "session_expires_at": _extract_dbcl2_expiry(state_json) if state_json else "",
        })

        # Close browser
        await loop.run_in_executor(None, lambda: client.__exit__(None, None, None))

        # Auto-scrape
        counts = {}
        if state_json:
            mgr = SessionManager(state_json=state_json)
            http = mgr.build_http_session()
            try:
                from community.douban.scrapers.books import BooksScraper
                from community.douban.scrapers.movies import MoviesScraper

                yield sse_event("scraping", {"phase": "books", "counts": {}})
                books = await loop.run_in_executor(
                    None,
                    lambda: BooksScraper(http, community_user_id).scrape(max_pages=0),
                )
                if books:
                    yield sse_event("data", {"type": "book", "items": [b.model_dump() for b in books]})
                    counts["books"] = len(books)

                yield sse_event("scraping", {"phase": "movies", "counts": counts})
                movies = await loop.run_in_executor(
                    None,
                    lambda: MoviesScraper(http, community_user_id).scrape(max_pages=0),
                )
                if movies:
                    yield sse_event("data", {"type": "movie", "items": [m.model_dump() for m in movies]})
                    counts["movies"] = len(movies)
            finally:
                http.close()

        yield sse_event("done", {"counts": counts})

    except Exception as e:
        log.exception("[bind/douban] Error")
        yield sse_event("error", {"error": str(e)})


async def _sync_douban(user_id, session_state_json, community_user_id, existing_book_urls, existing_movie_urls):
    from community.douban.session import SessionManager

    if not session_state_json:
        yield sse_event("error", {"error": "No session state"})
        return

    loop = asyncio.get_event_loop()
    counts = {}

    def _scrape():
        mgr = SessionManager(state_json=session_state_json)
        http = mgr.build_http_session()
        try:
            from community.douban.scrapers.books import BooksScraper
            from community.douban.scrapers.movies import MoviesScraper

            books = BooksScraper(http, community_user_id).scrape(
                max_pages=0,
                existing_urls=set(existing_book_urls),
            )
            movies = MoviesScraper(http, community_user_id).scrape(
                max_pages=0,
                existing_urls=set(existing_movie_urls),
            )
            return books, movies
        finally:
            http.close()

    yield sse_event("progress", {"status": "scraping", "phase": "books"})
    books, movies = await loop.run_in_executor(None, _scrape)

    if books:
        yield sse_event("data", {"type": "book", "items": [b.model_dump() for b in books]})
        counts["books"] = len(books)

    yield sse_event("progress", {"status": "scraping", "phase": "movies"})
    if movies:
        yield sse_event("data", {"type": "movie", "items": [m.model_dump() for m in movies]})
        counts["movies"] = len(movies)

    yield sse_event("done", {"counts": counts})


async def _refresh_douban(session_state_json: str):
    from community.douban.session import SessionManager
    from community.douban.scrapers.profile import ProfileScraper

    loop = asyncio.get_event_loop()

    def _do():
        mgr = SessionManager(state_json=session_state_json)
        http = mgr.build_http_session()
        try:
            # Need user_id from cookies
            import requests
            resp = http.get("https://www.douban.com/mine/")
            if resp.url.endswith("/mine/"):
                # Extract user_id from URL redirect
                pass
            # Fallback: scrape profile from /mine/ page
            from community.douban.scrapers.profile import ProfileScraper
            # Parse user_id from cookies
            user_id = None
            for cookie in http.cookies:
                if cookie.name == "dbcl2":
                    user_id = cookie.value.split('"')[1] if '"' in cookie.value else ""
                    break
            if not user_id:
                # Try to get from page
                resp = http.get("https://www.douban.com/mine/")
                import re
                match = re.search(r'douban\.com/people/([^/"]+)', resp.text)
                if match:
                    user_id = match.group(1)
            if not user_id:
                return None, ""
            profile = ProfileScraper(http, user_id).scrape()
            return user_id, profile
        finally:
            http.close()

    user_id, profile = await loop.run_in_executor(None, _do)
    if profile is None:
        return {"error": "Failed to refresh profile"}

    return {
        "community_user_id": user_id,
        "profile_json": profile.model_dump_json(),
    }


# ---- WeRead ----


async def _bind_weread(user_id: int, channel: str):
    from community.weread.client import WeReadClient

    task_id = uuid.uuid4().hex[:12]
    yield sse_event("progress", {"task_id": task_id, "status": "pending"})

    eq = queue.Queue()

    def _run():
        def capture_qr(data_bytes):
            eq.put(("qr", base64.b64encode(data_bytes).decode()))

        def capture_progress(status):
            eq.put(("status", status))

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
            eq.put(("error", str(e)))
            return
        eq.put(("done", client))

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run)

    client = None
    while client is None:
        try:
            tag, data = eq.get_nowait()
        except queue.Empty:
            await asyncio.sleep(0.3)
            continue
        if tag == "qr":
            yield sse_event("progress", {"task_id": task_id, "status": "pending", "qr_base64": f"data:image/png;base64,{data}"})
        elif tag == "status":
            yield sse_event("progress", {"task_id": task_id, "status": data})
        elif tag == "error":
            yield sse_event("error", {"error": data})
            return
        elif tag == "done":
            client = data

    try:
        yield sse_event("progress", {"task_id": task_id, "status": "logged_in"})
        yield sse_event("progress", {"task_id": task_id, "status": "fetching_profile"})

        yield sse_event("progress", {"task_id": task_id, "status": "logged_in"})
        yield sse_event("progress", {"task_id": task_id, "status": "fetching_profile"})

        profile = await loop.run_in_executor(None, client.scrape_profile)
        vid = client.vid
        state_json = client._session._state_json

        yield sse_event("bound", {
            "community_user_id": vid,
            "profile_json": profile.model_dump_json(),
            "session_state_json": state_json or "",
        })

        # Auto-scrape
        counts = {}

        yield sse_event("scraping", {"phase": "books", "counts": {}})
        from community.weread.scrapers.shelf import scrape_shelf
        books = await loop.run_in_executor(None, lambda: scrape_shelf(client._page, vid))
        if books:
            yield sse_event("data", {"type": "book", "items": [b.model_dump() for b in books]})
            counts["books"] = len(books)

        yield sse_event("scraping", {"phase": "bookmarks", "counts": counts})
        from community.weread.scrapers.bookmarks import scrape_bookmarks
        book_ids = [b.book_id for b in books] if books else []
        all_bookmarks = []
        for book_id in book_ids[:50]:
            bms, _ = await loop.run_in_executor(
                None, lambda bid=book_id: scrape_bookmarks(client._page, bid, 0)
            )
            if bms:
                all_bookmarks.extend(bms)
        if all_bookmarks:
            yield sse_event("data", {"type": "bookmark", "items": [b.model_dump() for b in all_bookmarks]})
            counts["bookmarks"] = len(all_bookmarks)

        yield sse_event("done", {"counts": counts})

        await loop.run_in_executor(None, lambda: client.__exit__(None, None, None))

    except Exception as e:
        log.exception("[bind/weread] Error")
        yield sse_event("error", {"error": str(e)})


async def _sync_weread(user_id, session_state_json, community_user_id, bookmark_synckeys):
    from community.weread.client import WeReadClient
    from community.weread.scrapers.shelf import scrape_shelf
    from community.weread.scrapers.bookmarks import scrape_bookmarks

    if not session_state_json:
        yield sse_event("error", {"error": "No session state"})
        return

    loop = asyncio.get_event_loop()

    def _open():
        client = WeReadClient(headless=True, state_json=session_state_json)
        client.__enter__()
        client.ensure_ready()
        return client

    client = await loop.run_in_executor(None, _open)
    counts = {}

    try:
        yield sse_event("progress", {"status": "scraping", "phase": "books"})
        books = await loop.run_in_executor(None, lambda: scrape_shelf(client._page, community_user_id))
        if books:
            yield sse_event("data", {"type": "book", "items": [b.model_dump() for b in books]})
            counts["books"] = len(books)

        yield sse_event("progress", {"status": "scraping", "phase": "bookmarks"})
        book_ids = [b.book_id for b in books] if books else []
        all_bookmarks = []
        new_synckeys = {}
        for book_id in book_ids[:50]:
            last_synckey = bookmark_synckeys.get(book_id, 0)
            bms, new_sk = await loop.run_in_executor(
                None, lambda bid=book_id, sk=last_synckey: scrape_bookmarks(client._page, bid, sk)
            )
            if bms:
                all_bookmarks.extend(bms)
            if new_sk != last_synckey:
                new_synckeys[book_id] = new_sk

        if all_bookmarks:
            yield sse_event("data", {"type": "bookmark", "items": [b.model_dump() for b in all_bookmarks]})
        if new_synckeys:
            yield sse_event("data", {"type": "synckeys", "synckeys": new_synckeys})
        counts["bookmarks"] = len(all_bookmarks)

        yield sse_event("done", {"counts": counts})
    except Exception as e:
        log.exception("[sync/weread] Error")
        yield sse_event("error", {"error": str(e)})
    finally:
        await loop.run_in_executor(None, lambda: client.__exit__(None, None, None))


async def _refresh_weread(session_state_json: str):
    from community.weread.client import WeReadClient

    loop = asyncio.get_event_loop()

    def _do():
        client = WeReadClient(headless=True, state_json=session_state_json)
        client.__enter__()
        client.ensure_ready()
        profile = client.scrape_profile()
        vid = client.vid
        client.__exit__(None, None, None)
        return vid, profile

    vid, profile = await loop.run_in_executor(None, _do)
    return {
        "community_user_id": vid,
        "profile_json": profile.model_dump_json(),
    }


# ---- Flomo ----


async def _bind_flomo(user_id: int, channel: str):
    from community.flomo.client import FlomoClient

    task_id = uuid.uuid4().hex[:12]
    yield sse_event("progress", {"task_id": task_id, "status": "pending"})

    eq = queue.Queue()
    saved_state = [None]

    def _run():
        def capture_qr(data_bytes):
            eq.put(("qr", base64.b64encode(data_bytes).decode()))

        def capture_progress(status):
            eq.put(("status", status))

        client = FlomoClient(
            headless=False,
            channel=channel,
            on_qr=capture_qr,
            on_progress=capture_progress,
            on_save_state=lambda s: saved_state.__setitem__(0, s),
        )
        client.__enter__()
        try:
            client.ensure_ready()
        except Exception as e:
            eq.put(("error", str(e)))
            return
        eq.put(("done", client))

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run)

    client = None
    while client is None:
        try:
            tag, data = eq.get_nowait()
        except queue.Empty:
            await asyncio.sleep(0.3)
            continue
        if tag == "qr":
            yield sse_event("progress", {"task_id": task_id, "status": "pending", "qr_base64": f"data:image/png;base64,{data}"})
        elif tag == "status":
            yield sse_event("progress", {"task_id": task_id, "status": data})
        elif tag == "error":
            yield sse_event("error", {"error": data})
            return
        elif tag == "done":
            client = data

    try:
        yield sse_event("progress", {"task_id": task_id, "status": "logged_in"})
        yield sse_event("progress", {"task_id": task_id, "status": "fetching_profile"})

        user_id_str = _extract_flomo_user_id(client.session) or uuid.uuid4().hex[:8]
        state_json = saved_state[0] or client.session._state_json
        profile = {"user_id": user_id_str, "name": "flomo"}

        yield sse_event("bound", {
            "community_user_id": user_id_str,
            "profile_json": json.dumps(profile),
            "session_state_json": state_json or "",
        })

        # Auto-scrape memos -- also use queue for export progress
        counts = {}
        yield sse_event("scraping", {"phase": "memos", "counts": {}})

        export_eq = queue.Queue()

        def _export():
            # Reuse the same queue for export progress callbacks
            def on_export_progress(status):
                export_eq.put(("status", status))

            client._on_progress = on_export_progress
            try:
                memos = client.export_notes()
                export_eq.put(("done", memos))
            except Exception as e:
                export_eq.put(("error", str(e)))

        loop.run_in_executor(None, _export)

        memos = None
        while memos is None:
            try:
                tag, data = export_eq.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.3)
                continue
            if tag == "status":
                yield sse_event("scraping", {"phase": data, "counts": counts})
            elif tag == "error":
                yield sse_event("error", {"error": data})
                return
            elif tag == "done":
                memos = data

        if memos:
            yield sse_event("data", {"type": "memo", "items": [m.model_dump() for m in memos]})
            counts["memos"] = len(memos)

        await loop.run_in_executor(None, lambda: client.__exit__(None, None, None))
        yield sse_event("done", {"counts": counts})

    except Exception as e:
        log.exception("[bind/flomo] Error")
        yield sse_event("error", {"error": str(e)})


async def _sync_flomo(user_id, session_state_json, community_user_id):
    from community.flomo.client import FlomoClient

    if not session_state_json:
        yield sse_event("error", {"error": "No session state"})
        return

    loop = asyncio.get_event_loop()

    def _open():
        client = FlomoClient(headless=False, state_json=session_state_json)
        client.__enter__()
        client.ensure_ready()
        return client

    client = await loop.run_in_executor(None, _open)
    counts = {}

    try:
        yield sse_event("progress", {"status": "scraping", "phase": "memos"})
        memos = await loop.run_in_executor(None, client.export_notes)
        if memos:
            yield sse_event("data", {"type": "memo", "items": [m.model_dump() for m in memos]})
            counts["memos"] = len(memos)
        yield sse_event("done", {"counts": counts})
    except Exception as e:
        log.exception("[sync/flomo] Error")
        yield sse_event("error", {"error": str(e)})
    finally:
        await loop.run_in_executor(None, lambda: client.__exit__(None, None, None))


async def _refresh_flomo(session_state_json: str):
    from community.flomo.client import FlomoClient

    loop = asyncio.get_event_loop()

    def _do():
        client = FlomoClient(headless=True, state_json=session_state_json)
        client.__enter__()
        client.ensure_ready()
        user_id_str = _extract_flomo_user_id(client.session) or "unknown"
        client.__exit__(None, None, None)
        return user_id_str

    user_id_str = await loop.run_in_executor(None, _do)
    profile = {"user_id": user_id_str, "name": "flomo"}
    return {
        "community_user_id": user_id_str,
        "profile_json": json.dumps(profile),
    }


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=50051)
