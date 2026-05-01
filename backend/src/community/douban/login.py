from playwright.sync_api import Page

from . import BASE_URL

_LOGIN_URL = "https://accounts.douban.com/passport/login"


class DoubanLogin:
    """Handles QR code login flow for Douban."""

    def __init__(self, page: Page):
        self._page = page

    def initiate_qr_login(self) -> bytes:
        """Navigate to login, switch to QR mode, screenshot QR code to memory."""
        self._page.goto(_LOGIN_URL)
        self._page.wait_for_load_state("domcontentloaded")

        # Switch to QR code mode
        self._page.click(".quick.icon-switch")
        qr_img = self._page.wait_for_selector('img[alt="QR Code"]')

        # Wait for the QR image to fully load before screenshot
        qr_img.wait_for_element_state("stable")
        self._page.wait_for_function(
            "el => el.complete && el.naturalHeight > 0",
            arg=qr_img,
        )

        return qr_img.screenshot()

    def wait_for_login(self, timeout: float = 120.0) -> bool:
        """Wait for user to scan QR and complete login."""
        try:
            self._page.wait_for_url(f"{BASE_URL}/**", timeout=timeout * 1000)
            return True
        except Exception:
            return False

    def is_logged_in(self, page: Page) -> bool:
        """Check if the page shows authenticated state."""
        return bool(page.query_selector('a[href*="/mine/"]'))
