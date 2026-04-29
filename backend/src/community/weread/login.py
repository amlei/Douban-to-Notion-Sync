from __future__ import annotations

from playwright.sync_api import BrowserContext, FrameLocator, Locator, Page

from . import BASE_URL


class WeReadLogin:
    """Handles QR code login flow for WeRead.

    WeRead login uses an iframe with two possible states:
    - Direct QR code (computer has no WeChat login)
    - Auto-detected WeChat with "quick login" button
      -> must click "use other account" to switch to QR mode
    """

    def __init__(self, page: Page, context: BrowserContext):
        self._page = page
        self._context = context

    def initiate_qr_login(self) -> bytes:
        """Navigate to weread, trigger login, capture QR code screenshot."""
        self._page.goto(BASE_URL)
        self._page.wait_for_load_state("networkidle")

        # Click login button -- try multiple strategies
        self._click_login_button()

        # Wait for login dialog to appear
        self._page.wait_for_timeout(3000)

        # The WeChat quick-login iframe is inside .login_dialog_content_quick.
        # Its src points to open.weixin.qq.com. The QR code is NOT in this iframe.
        iframe_loc = self._page.frame_locator(
            'iframe[src*="open.weixin.qq.com"]'
        ).first

        # Handle "quick login" auto-detection
        self._switch_to_qr_mode(iframe_loc)

        # Wait for QR code image on the main page and screenshot
        # The QR code lives in .login_dialog_content_main, NOT inside the WeChat iframe.
        # The actual alt text is "扫码登录" (not "登录二维码").
        qr_loc = self._page.locator('img[alt="扫码登录"]')
        if not qr_loc.is_visible():
            # Fallback to old alt text in case the UI varies
            qr_loc = self._page.locator('img[alt="登录二维码"]')
        qr_loc.wait_for(state="visible", timeout=15000)
        return qr_loc.first.screenshot()

    def _click_login_button(self) -> None:
        """Find and click the login button on the main page."""
        # Strategy 1: exact text "登录"
        try:
            login_btn = self._page.get_by_text("登录", exact=True)
            login_btn.wait_for(state="visible", timeout=8000)
            login_btn.click()
            return
        except Exception:
            pass

        # Strategy 2: link or button role
        for role in ("link", "button"):
            try:
                login_btn = self._page.get_by_role(role, name="登录")
                login_btn.wait_for(state="visible", timeout=3000)
                login_btn.click()
                return
            except Exception:
                pass

        # Strategy 3: CSS selector for common login button patterns
        for selector in [
            'a[href*="login"]',
            'button:has-text("登录")',
            '[class*="login"]',
        ]:
            try:
                login_btn = self._page.locator(selector).first
                login_btn.wait_for(state="visible", timeout=3000)
                login_btn.click()
                return
            except Exception:
                pass

        raise RuntimeError("Could not find WeRead login button on the page")

    def _switch_to_qr_mode(self, iframe_loc: FrameLocator) -> None:
        """If WeChat quick login is detected, switch to QR code mode."""
        try:
            quick_btn = iframe_loc.get_by_role("button", name="微信快捷登录")
            quick_btn.wait_for(state="visible", timeout=5000)
            # Click "use other account" to switch to QR mode
            other_btn = iframe_loc.get_by_role(
                "button", name="使用其他头像、昵称或账号"
            )
            other_btn.click()
            self._page.wait_for_timeout(3000)
        except Exception:
            pass  # No quick login detected -- QR shown directly

    def wait_for_login(self, timeout: float = 120.0) -> str | None:
        """Poll cookies for wr_skey + wr_vid. Returns vid on success, None on timeout."""
        interval = 2  # seconds
        attempts = int(timeout / interval)
        for _ in range(attempts):
            self._page.wait_for_timeout(interval * 1000)
            cookies = self._context.cookies()
            wr_skey = next(
                (c["value"] for c in cookies if c["name"] == "wr_skey"), None
            )
            vid = next(
                (c["value"] for c in cookies if c["name"] == "wr_vid"), None
            )
            if wr_skey and vid:
                return vid
        return None
