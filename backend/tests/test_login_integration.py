"""Integration tests for Douban login flow.

Runs a real Chromium browser via Playwright. Tests require manual QR scan
unless a valid session state already exists.

Usage:
    uv run pytest tests/test_login_integration.py -v -s
"""

import re

import pytest
from playwright.sync_api import sync_playwright

from src.community.douban.login import DoubanLogin
from src.community.douban.session import SessionManager


@pytest.fixture(scope="module")
def playwright_instance():
    pw = sync_playwright().start()
    yield pw
    pw.stop()


@pytest.fixture(scope="module")
def browser(playwright_instance):
    b = playwright_instance.chromium.launch(headless=False, channel="msedge")
    yield b
    b.close()


def test_qr_login_flow(browser, tmp_path):
    """Full flow: show QR -> wait for scan -> verify login state -> save session."""
    saved_state = {}

    def on_save(state_json):
        saved_state["json"] = state_json

    session = SessionManager(on_save_state=on_save)
    storage = session.get_storage_state()

    context = browser.new_context(storage_state=storage)
    page = context.new_page()

    try:
        page.goto("https://www.douban.com/")
        page.wait_for_load_state("domcontentloaded")

        login = DoubanLogin(page)

        # Already logged in from saved session
        if login.is_logged_in(page):
            print(">>> Already logged in")
        else:
            qr_bytes = login.initiate_qr_login()
            print(f"\n>>> QR code captured ({len(qr_bytes)} bytes)")

            while not login.is_logged_in(page):
                page.wait_for_timeout(2000)

        # Save session state
        session.save_state(context)
        assert session.has_valid_session

        # Extract user_id
        page.goto("https://www.douban.com/mine/")
        page.wait_for_load_state("domcontentloaded")
        m = re.search(r"/people/(\d+)", page.url)
        assert m, f"Cannot extract user_id from URL: {page.url}"
        user_id = m.group(1)
        assert user_id.isdigit()

        print(f">>> Login successful. user_id={user_id}")

    finally:
        context.close()
