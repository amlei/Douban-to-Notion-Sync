from __future__ import annotations

from typing import Callable

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from .login import WeReadLogin
from . import BASE_URL
from .models.book import Book
from .models.bookmark import Bookmark
from .models.profile import Profile
from .scrapers.bookmarks import scrape_bookmarks
from .scrapers.profile import scrape_profile as _scrape_profile
from .scrapers.shelf import scrape_book_info, scrape_shelf
from .session import SessionManager

ProgressCallback = Callable[[str], None]
QrCallback = Callable[[bytes], None]


class WeReadClient:
    """WeRead data client: uses Playwright for login and data fetching.

    Unlike Douban, WeRead APIs require browser context (page.evaluate + fetch).
    The browser stays open for the entire session.

    Usage::

        with WeReadClient() as client:
            client.ensure_ready()
            profile = client.scrape_profile()
            books = client.scrape_shelf()
    """

    def __init__(
        self,
        headless: bool = True,
        channel: str = "msedge",
        on_progress: ProgressCallback | None = None,
        on_qr: QrCallback | None = None,
        state_json: str | None = None,
        on_save_state: Callable[[str], None] | None = None,
    ):
        self._headless = headless
        self._channel = channel
        self._session = SessionManager(
            state_json=state_json,
            on_save_state=on_save_state,
        )
        self._on_progress = on_progress
        self._on_qr = on_qr
        self._vid: str | None = None
        self._pw = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    def __enter__(self) -> "WeReadClient":
        self._start_browser()
        return self

    def __exit__(self, *exc) -> None:
        self._close_browser()

    @property
    def vid(self) -> str | None:
        return self._vid

    @property
    def session(self) -> SessionManager:
        return self._session

    @property
    def page(self) -> Page | None:
        return self._page

    def _notify(self, status: str) -> None:
        if self._on_progress:
            self._on_progress(status)

    def _start_browser(self) -> None:
        """Launch Playwright browser and create context with saved state."""
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=self._headless, channel=self._channel
        )
        storage_state = self._session.get_storage_state()
        self._context = self._browser.new_context(storage_state=storage_state)
        self._page = self._context.new_page()

        # Extract vid from saved state if available
        if not self._vid:
            self._vid = self._session.vid

    def _close_browser(self) -> None:
        """Close browser and stop Playwright."""
        for resource in (self._context, self._browser):
            if resource:
                try:
                    resource.close()
                except Exception:
                    pass
        if self._pw:
            try:
                self._pw.stop()
            except Exception:
                pass
        self._context = None
        self._browser = None
        self._pw = None
        self._page = None

    def ensure_ready(self) -> None:
        """Ensure we have a valid session. Login via QR if needed."""
        self._page.goto(BASE_URL)
        self._page.wait_for_load_state("networkidle")

        if self._vid and self._check_auth():
            self._notify("logged_in")
            return

        self._run_login()

    def _check_auth(self) -> bool:
        """Quick auth check by calling /web/user API."""
        try:
            result = self._page.evaluate(
                """async () => {
                    try {
                        const r = await fetch('/web/user?userVid=0');
                        return r.ok;
                    } catch { return false; }
                }"""
            )
            return bool(result)
        except Exception:
            return False

    def _run_login(self) -> None:
        """Run the QR code login flow."""
        login = WeReadLogin(self._page, self._context)
        qr_bytes = login.initiate_qr_login()
        if self._on_qr:
            self._on_qr(qr_bytes)
        self._notify("pending")

        vid = login.wait_for_login(timeout=120.0)
        if not vid:
            raise RuntimeError("WeRead login timeout")

        self._vid = vid
        self._notify("scanned")

        # Save session state
        self._session.save_state(self._context)
        self._notify("logged_in")

    def scrape_profile(self) -> Profile:
        """Fetch user profile."""
        if not self._vid:
            raise RuntimeError("Not logged in -- no vid")
        return _scrape_profile(self._page, self._vid)

    def scrape_shelf(self) -> list[Book]:
        """Fetch all books from shelf."""
        if not self._vid:
            raise RuntimeError("Not logged in -- no vid")
        return scrape_shelf(self._page, self._vid)

    def scrape_book_info(self, book_id: str) -> Book | None:
        """Fetch detail for a single book."""
        return scrape_book_info(self._page, book_id)

    def scrape_bookmarks(self, book_id: str, synckey: int = 0) -> tuple[list[Bookmark], int]:
        """Fetch bookmarks/notes for a single book. Returns (bookmarks, new_synckey)."""
        return scrape_bookmarks(self._page, book_id, synckey)
