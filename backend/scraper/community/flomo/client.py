from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from . import BASE_URL
from .login import FlomoLogin
from .session import SessionManager

log = logging.getLogger("flomo")

ProgressCallback = Callable[[str], None]
QrCallback = Callable[[bytes], None]


class FlomoClient:
    """Flomo data client.

    First-time flow:  ensure_ready() -> login (browser stays open) -> download_export() -> close.
    Subsequent flow:  ensure_ready() -> skip (session valid) -> download_export() -> open browser -> export -> close.

    Usage::

        with FlomoClient() as client:
            client.ensure_ready()
            zip_path = client.download_export()
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
        self._pw = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    def __enter__(self) -> "FlomoClient":
        return self

    def __exit__(self, *exc) -> None:
        self._close_browser()

    @property
    def session(self) -> SessionManager:
        return self._session

    def _notify(self, status: str) -> None:
        if self._on_progress:
            self._on_progress(status)

    def _start_browser(self, accept_downloads: bool = False) -> None:
        """Launch Playwright browser with saved session state."""
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=self._headless, channel=self._channel,
        )
        storage_state = self._session.get_storage_state()
        self._context = self._browser.new_context(
            storage_state=storage_state,
            accept_downloads=accept_downloads,
        )
        self._page = self._context.new_page()

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
        self._pw = None
        self._browser = None
        self._context = None
        self._page = None

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------

    def ensure_ready(self) -> None:
        """Ensure session is valid. Login via QR if needed.

        After login the browser stays open so download_export() can reuse it.
        """
        if self._session.has_valid_session:
            self._notify("logged_in")
            return

        self._start_browser(accept_downloads=True)
        self._page.goto(BASE_URL)  # type: ignore[union-attr]
        self._page.wait_for_load_state("domcontentloaded")  # type: ignore[union-attr]

        login = FlomoLogin(self._page, self._context)  # type: ignore[arg-type]
        if login.is_on_login_page():
            qr_bytes = login.initiate_qr_login()
            if self._on_qr:
                self._on_qr(qr_bytes)
            self._notify("pending")

            ok = login.wait_for_login(timeout=120.0)
            if not ok:
                self._close_browser()
                raise RuntimeError("Flomo login timeout")

            self._notify("scanned")

        self._notify("logged_in")
        self._session.save_state(self._context)  # type: ignore[arg-type]

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def download_export(self, save_dir: str | None = None) -> Path:
        """Download flomo export zip via browser. Returns zip path (caller should clean up)."""
        if not self._session.has_valid_session:
            raise RuntimeError("No valid session -- call ensure_ready() first")

        if save_dir is None:
            save_dir = str(Path(__file__).resolve().parents[3] / "tmp")
        out_dir = Path(save_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        log.info("[export] save_dir=%s, page=%s", out_dir, self._page is not None)

        if not self._page:
            self._start_browser(accept_downloads=True)

        def _dismiss_popups() -> None:
            """Try to close any popup overlay before each interaction."""
            for sel in (
                "div.el-dialog[role=dialog] .close",
                ".el-dialog__wrapper .close",
            ):
                try:
                    btn = page.locator(sel).first
                    if btn.is_visible(timeout=3000):
                        btn.click()
                        log.info("[popup] Closed a popup (%s)", sel)
                        page.wait_for_timeout(500)
                except Exception:
                    pass

        page = self._page
        try:
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            log.info("[export] Navigated to %s, url=%s", BASE_URL, page.url)

            _dismiss_popups()

            # Click account name to open menu
            _dismiss_popups()
            menu_trigger = page.locator("div.menu-trigger-content").first
            menu_trigger.click()
            page.wait_for_timeout(1000)

            # Click "导出/导入笔记"
            _dismiss_popups()
            export_menu = page.get_by_text("导出/导入笔记", exact=True)
            export_menu.click()
            page.wait_for_timeout(1000)
            log.info("[export] Clicked export menu")

            # Click "导出笔记" tab
            _dismiss_popups()
            export_tab = page.get_by_text("导出笔记", exact=True)
            if export_tab.is_visible():
                export_tab.click()
                page.wait_for_timeout(500)

            # Click "导出" button and wait for download
            _dismiss_popups()
            export_btn = page.get_by_role("button", name="导出")
            with page.expect_download(timeout=60000) as download_info:
                export_btn.click()
            log.info("[export] Clicked export button, waiting for download...")

            download = download_info.value
            zip_path = out_dir / download.suggested_filename
            download.save_as(str(zip_path))
            log.info("[export] Downloaded zip to %s", zip_path)

            self._notify("exported")
        except Exception:
            log.exception("[export] Error during export")
            raise
        finally:
            self._close_browser()

        return zip_path
