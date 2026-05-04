import json
from pathlib import Path
from typing import Callable

from playwright.sync_api import BrowserContext

import requests


from .. import DEFAULT_HEADERS

_LOCAL_STORAGE_ME_KEY = "me"


def _find_me_in_state(data: dict) -> dict | None:
    """Extract the 'me' localStorage entry from Playwright storage state."""
    for origin in data.get("origins", []):
        for entry in origin.get("localStorage", []):
            if entry.get("name") == _LOCAL_STORAGE_ME_KEY:
                try:
                    return json.loads(entry.get("value", "{}"))
                except (json.JSONDecodeError, TypeError):
                    continue
    return None


def extract_profile_from_state(state_json: str | None) -> dict | None:
    """Extract user profile fields from the flomo 'me' localStorage object."""
    if not state_json:
        return None
    try:
        data = json.loads(state_json)
    except (json.JSONDecodeError, OSError):
        return None
    me = _find_me_in_state(data)
    if not me:
        return None
    profile = {}
    if me.get("id"):
        profile["user_id"] = str(me["id"])
    for key in ("name", "email", "avatar"):
        if me.get(key):
            profile[key] = me[key]
    return profile if profile else None


class SessionManager:
    """Manages Flomo Playwright session state.

    Flomo stores auth in localStorage (key "me" with access_token), not cookies.
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
        """Check if session state exists and contains a valid access_token."""
        if not self._state_json:
            return False
        try:
            data = json.loads(self._state_json)
        except (json.JSONDecodeError, OSError):
            return False
        me = _find_me_in_state(data)
        return me is not None and bool(me.get("access_token"))

    def get_storage_state(self) -> str | None:
        """Write state JSON to a temp file and return the path for Playwright."""
        if not self._state_json:
            return None
        tmp = Path(__file__).resolve().parents[4] / "tmp" / "flomo-state-db.json"
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
        """Build a requests.Session with cookies from saved state."""
        from http.cookiejar import Cookie

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
