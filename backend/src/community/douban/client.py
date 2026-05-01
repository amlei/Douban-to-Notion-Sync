from __future__ import annotations

from typing import Callable

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright
import requests

from .models.book import Book
from .models.game import Game
from .models.movie import Movie
from .models.note import Note
from .models.profile import Profile
from .models.review import Review
from . import BASE_URL
from .login import DoubanLogin
from .scrapers.books import BooksScraper
from .scrapers.games import GamesScraper
from .scrapers.movies import MoviesScraper
from .scrapers.notes import NotesScraper
from .scrapers.profile import ProfileScraper
from .scrapers.reviews import ReviewsScraper
from .session import SessionManager

ProgressCallback = Callable[[str], None]
QrCallback = Callable[[bytes], None]


class DoubanClient:
    """Douban data client: Playwright for login, requests for scraping.

    Usage::

        with DoubanClient(user_id="215871379") as client:
            client.ensure_ready()
            profile = client.scrape_profile()
            books = client.scrape_books()
    """

    def __init__(
        self,
        user_id: str | None = None,
        headless: bool = True,
        channel: str = "msedge",
        on_progress: ProgressCallback | None = None,
        on_qr: QrCallback | None = None,
        state_json: str | None = None,
        on_save_state: Callable[[str], None] | None = None,
    ):
        self._user_id = user_id
        self._headless = headless
        self._channel = channel
        self._session = SessionManager(
            state_json=state_json,
            on_save_state=on_save_state,
        )
        self._http: requests.Session | None = None
        self._on_progress = on_progress
        self._on_qr = on_qr

    def __enter__(self) -> "DoubanClient":
        self._http = self._session.build_http_session()
        return self

    def __exit__(self, *exc) -> None:
        if self._http:
            self._http.close()

    @property
    def user_id(self) -> str:
        return self._user_id

    @property
    def session(self) -> SessionManager:
        return self._session

    def _notify(self, status: str) -> None:
        if self._on_progress:
            self._on_progress(status)

    def _run_playwright_login(self) -> None:
        """Launch Playwright solely for login, then close it and refresh http session."""
        pw = sync_playwright().start()
        browser: Browser | None = None
        context: BrowserContext | None = None
        try:
            browser = pw.chromium.launch(headless=self._headless, channel=self._channel)
            storage_state = self._session.get_storage_state()
            context = browser.new_context(storage_state=storage_state)
            page = context.new_page()

            page.goto(f"{BASE_URL}/")
            page.wait_for_load_state("domcontentloaded")

            login = DoubanLogin(page)
            if not login.is_logged_in(page):
                qr_bytes = login.initiate_qr_login()
                if self._on_qr:
                    self._on_qr(qr_bytes)
                self._notify("pending")

                try:
                    page.wait_for_selector(".account-qr-success", state="visible", timeout=120_000)
                    self._notify("scanned")
                except Exception:
                    pass

                if "www.douban.com" not in page.url:
                    ok = login.wait_for_login(timeout=60.0)
                    if not ok:
                        raise RuntimeError("Login failed")

            self._notify("logged_in")
            self._session.save_state(context)

            # Auto-detect user_id from /mine/ redirect
            if not self._user_id:
                import re
                page.goto(f"{BASE_URL}/mine/")
                page.wait_for_load_state("domcontentloaded")
                m = re.search(r"/people/(\d+)", page.url)
                if not m:
                    raise RuntimeError(f"Cannot extract user_id from URL: {page.url}")
                self._user_id = m.group(1)
        finally:
            try:
                if context:
                    context.close()
            except Exception:
                pass
            try:
                if browser:
                    browser.close()
            except Exception:
                pass
            try:
                pw.stop()
            except Exception:
                pass

        # Rebuild http session with fresh cookies
        self._http = self._session.build_http_session()

    def _ensure_user_id_via_http(self) -> None:
        """Try to detect user_id via HTTP redirect without Playwright."""
        if self._user_id:
            return
        import re
        resp = self._http.get(f"{BASE_URL}/mine/", allow_redirects=True)
        m = re.search(r"/people/(\d+)", resp.url)
        if not m:
            raise RuntimeError(f"Cannot extract user_id from URL: {resp.url}")
        self._user_id = m.group(1)

    def ensure_ready(self) -> None:
        """Ensure session is valid. Login via Playwright only if needed."""
        if self._session.has_valid_session:
            self._ensure_user_id_via_http()
            return

        self._run_playwright_login()

    def scrape_profile(self) -> Profile:
        return ProfileScraper(self._http, self._user_id).scrape()

    def scrape_books(self, max_pages: int = 1) -> list[Book]:
        return BooksScraper(self._http, self._user_id).scrape(max_pages)

    def scrape_movies(self, max_pages: int = 1) -> list[Movie]:
        return MoviesScraper(self._http, self._user_id).scrape(max_pages)

    def scrape_games(self, max_pages: int = 1) -> list[Game]:
        return GamesScraper(self._http, self._user_id).scrape(max_pages)

    def scrape_reviews(self, max_pages: int = 1) -> list[Review]:
        return ReviewsScraper(self._http, self._user_id).scrape(max_pages)

    def scrape_notes(self) -> list[Note]:
        return NotesScraper(self._http, self._user_id).scrape()
