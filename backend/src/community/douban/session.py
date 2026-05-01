import json
import time
from http.cookiejar import Cookie
from pathlib import Path
from typing import Callable

from playwright.sync_api import BrowserContext

import requests


from .. import DEFAULT_HEADERS

_AUTH_COOKIE = "dbcl2"


class SessionManager:
    """Manages Douban Playwright session state (cookies + localStorage).

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

    def get_storage_state(self) -> str | None:
        """Write state JSON to a temp file and return the path for Playwright."""
        if not self._state_json:
            return None
        tmp = Path(__file__).resolve().parents[4] / "tmp" / "douban-state-db.json"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(self._state_json, encoding="utf-8")
        return str(tmp)

    def save_state(self, context: BrowserContext) -> None:
        """Persist browser context state via the callback."""
        state = context.storage_state()
        self._state_json = json.dumps(state, ensure_ascii=False)
        if self._on_save_state:
            self._on_save_state(self._state_json)

    def build_http_session(self) -> requests.Session:
        """Build a requests.Session with cookies and headers from saved state."""
        session = requests.Session()
        session.headers.update(DEFAULT_HEADERS)

        if not self._state_json:
            return session
        try:
            data = json.loads(self._state_json)
        except (json.JSONDecodeError, OSError):
            return session

        for c in data.get("cookies", []):
            jar_cookie = Cookie(
                version=0,
                name=c["name"],
                value=c["value"],
                port=None,
                port_specified=False,
                domain=c.get("domain", ""),
                domain_specified=bool(c.get("domain")),
                domain_initial_dot=c.get("domain", "").startswith("."),
                path=c.get("path", "/"),
                path_specified=True,
                secure=c.get("secure", False),
                expires=int(c.get("expires", -1)),
                discard=False,
                comment=None,
                comment_url=None,
                rest={},
            )
            session.cookies.set_cookie(jar_cookie)

        return session
