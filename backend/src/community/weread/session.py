import json
import time
from pathlib import Path
from typing import Callable

from playwright.sync_api import BrowserContext


_AUTH_COOKIE = "wr_skey"
_VID_COOKIE = "wr_vid"


class SessionManager:
    """Manages WeRead Playwright session state (cookies).

    Operates in DB mode: receives pre-loaded JSON string from the database
    and writes back through a callback.
    """

    def __init__(
        self,
        state_json: str | None = None,
        on_save_state: Callable[[str], None] | None = None,
    ):
        self._state_json = state_json
        self._on_save_state = on_save_state

    @property
    def has_valid_session(self) -> bool:
        """Check if session state exists and the auth cookie has not expired."""
        if not self._state_json:
            return False
        try:
            data = json.loads(self._state_json)
        except (json.JSONDecodeError, OSError):
            return False
        now = time.time()
        for cookie in data.get("cookies", []):
            if cookie.get("name") == _AUTH_COOKIE:
                return cookie.get("expires", -1) > now
        return False

    @property
    def vid(self) -> str | None:
        """Extract wr_vid from saved state cookies."""
        if not self._state_json:
            return None
        try:
            data = json.loads(self._state_json)
        except (json.JSONDecodeError, OSError):
            return None
        for cookie in data.get("cookies", []):
            if cookie.get("name") == _VID_COOKIE:
                return cookie.get("value")
        return None

    def get_storage_state(self) -> str | None:
        """Write state JSON to a temp file and return the path for Playwright."""
        if not self._state_json:
            return None
        tmp = Path(__file__).resolve().parents[4] / "tmp" / "weread-state-db.json"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(self._state_json, encoding="utf-8")
        return str(tmp)

    def save_state(self, context: BrowserContext) -> None:
        """Persist browser context state via the callback."""
        state = context.storage_state()
        self._state_json = json.dumps(state, ensure_ascii=False)
        if self._on_save_state:
            self._on_save_state(self._state_json)

    def update_from_cookies(self, cookies: list[dict]) -> None:
        """Update session state with fresh cookies (e.g., after login poll)."""
        if not self._state_json:
            self._state_json = json.dumps({"cookies": cookies, "origins": []})
        else:
            data = json.loads(self._state_json)
            existing = {c["name"]: c for c in data.get("cookies", [])}
            for c in cookies:
                existing[c["name"]] = c
            data["cookies"] = list(existing.values())
            self._state_json = json.dumps(data, ensure_ascii=False)
        if self._on_save_state:
            self._on_save_state(self._state_json)
