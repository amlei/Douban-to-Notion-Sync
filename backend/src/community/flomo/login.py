from playwright.sync_api import BrowserContext, Page

from . import BASE_URL, LOGIN_URL


class FlomoLogin:
    """Handles WeChat QR code login flow for Flomo."""

    def __init__(self, page: Page, context: BrowserContext):
        self._page = page
        self._context = context

    def is_on_login_page(self) -> bool:
        """Check if current page is the login page."""
        return LOGIN_URL in self._page.url

    def initiate_qr_login(self) -> bytes:
        """Click WeChat login, capture QR code screenshot from dialog."""
        # Click "使用微信登录" button
        wechat_btn = self._page.locator("text=使用微信登录").first
        wechat_btn.click()

        # Wait for QR code dialog to appear
        dialog = self._page.get_by_role("dialog", name="dialog")
        dialog.wait_for(state="visible", timeout=10000)

        # Screenshot the dialog containing the QR code
        return dialog.screenshot()

    def wait_for_login(self, timeout: float = 120.0) -> bool:
        """Wait for QR scan to complete by polling URL change to /mine."""
        interval = 2
        attempts = int(timeout / interval)
        for _ in range(attempts):
            self._page.wait_for_timeout(interval * 1000)
            if BASE_URL in self._page.url:
                return True
        return False
