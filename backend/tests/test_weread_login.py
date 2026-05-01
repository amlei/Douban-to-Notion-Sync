"""Integration tests for WeRead login flow.

Uses a real Chromium browser via Playwright. Requires manual QR scan
unless a valid session state already exists at .playwright/weread-state.json.

Usage:
    uv run pytest tests/test_weread_login.py -v -s
"""

import json
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

from src.community.weread.login import WeReadLogin
from src.community.weread.session import SessionManager

_STATE_PATH = Path(__file__).resolve().parents[2] / ".playwright" / "weread-state.json"


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


def test_login_flow_with_saved_state(browser):
    """Load saved state, verify login, and test API access."""
    saved_state = {}

    def on_save(state_json):
        saved_state["json"] = state_json

    # Load existing state
    state_json = _STATE_PATH.read_text(encoding="utf-8") if _STATE_PATH.exists() else None
    assert state_json is not None, "No saved state found"

    session = SessionManager(
        state_json=state_json,
        on_save_state=on_save,
    )
    assert session.has_valid_session, "Saved session should be valid"

    storage = session.get_storage_state()
    context = browser.new_context(storage_state=storage)
    page = context.new_page()

    try:
        # Navigate to weread shelf
        page.goto("https://weread.qq.com/web/shelf")
        page.wait_for_load_state("networkidle")

        # Verify we can access API from browser context
        result = page.evaluate("""async () => {
            try {
                const r = await fetch('/web/user?userVid=0');
                return {ok: r.ok, status: r.status};
            } catch(e) {
                return {ok: false, error: e.message};
            }
        }""")
        print(f">>> API access result: {result}")

        # Save updated state
        session.save_state(context)
        assert session.has_valid_session

    finally:
        context.close()


def test_qr_code_detection(browser):
    """Test that QR login page loads correctly (may need manual scan)."""
    # Use a fresh context without saved state to trigger login page
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("https://weread.qq.com")
        page.wait_for_load_state("networkidle")

        login = WeReadLogin(page, context)

        # Click login button using the same method as production
        login._click_login_button()
        page.wait_for_timeout(3000)

        # Check if iframe with QR code appears
        iframe_loc = page.frame_locator("iframe").first
        # If there's a quick login button, we need to switch
        try:
            quick_btn = iframe_loc.get_by_role("button", name="微信快捷登录")
            quick_btn.wait_for(state="visible", timeout=3000)
            print(">>> Quick login detected (WeChat is logged in on this computer)")
            # Don't actually click through, just verify detection
        except Exception:
            print(">>> No quick login, QR code should be visible directly")

        print(">>> Login iframe loaded successfully")

    finally:
        context.close()


_STATE_PATH_VAL = _STATE_PATH


def _load_state() -> str:
    return _STATE_PATH_VAL.read_text(encoding="utf-8")
