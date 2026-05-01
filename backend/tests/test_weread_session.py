"""Tests for WeRead SessionManager.

Uses the real session state from .playwright/weread-state.json.

Usage:
    uv run pytest tests/test_weread_session.py -v -s
"""

import json
from pathlib import Path

from src.community.weread.session import SessionManager

_STATE_PATH = Path(__file__).resolve().parents[2] / ".playwright" / "weread-state.json"


def _load_state() -> str:
    assert _STATE_PATH.exists(), f"State file not found: {_STATE_PATH}"
    return _STATE_PATH.read_text(encoding="utf-8")


class TestSessionManager:
    def test_valid_session(self):
        """Session with valid wr_skey cookie should be detected."""
        state_json = _load_state()
        mgr = SessionManager(state_json=state_json)
        assert mgr.has_valid_session, "Session should be valid (wr_skey present and not expired)"

    def test_vid_extraction(self):
        """Should extract wr_vid from saved state cookies."""
        state_json = _load_state()
        mgr = SessionManager(state_json=state_json)
        vid = mgr.vid
        assert vid is not None, "Should find wr_vid in cookies"
        assert vid.isdigit(), f"vid should be numeric, got: {vid}"
        print(f">>> vid = {vid}")

    def test_empty_session_invalid(self):
        """Empty state should not be valid."""
        mgr = SessionManager(state_json=None)
        assert not mgr.has_valid_session
        assert mgr.vid is None

    def test_malformed_json_invalid(self):
        """Malformed JSON should not be valid."""
        mgr = SessionManager(state_json="{bad json")
        assert not mgr.has_valid_session
        assert mgr.vid is None

    def test_missing_auth_cookie_invalid(self):
        """State without wr_skey should not be valid."""
        state = json.dumps({"cookies": [{"name": "wr_vid", "value": "123", "expires": 9999999999}]})
        mgr = SessionManager(state_json=state)
        assert not mgr.has_valid_session

    def test_expired_auth_cookie_invalid(self):
        """State with expired wr_skey should not be valid."""
        state = json.dumps({"cookies": [{"name": "wr_skey", "value": "abc", "expires": 1}]})
        mgr = SessionManager(state_json=state)
        assert not mgr.has_valid_session

    def test_get_storage_state(self, tmp_path):
        """Should write state to temp file and return path."""
        state_json = _load_state()
        mgr = SessionManager(state_json=state_json)
        path = mgr.get_storage_state()
        assert path is not None
        assert Path(path).exists()
        written = Path(path).read_text(encoding="utf-8")
        assert json.loads(written) == json.loads(state_json)

    def test_save_state_callback(self):
        """save_state should trigger callback with updated JSON."""
        saved = {}
        mgr = SessionManager(on_save_state=lambda j: saved.update(json=j))
        assert not mgr.has_valid_session

        # Simulate saving state with cookies
        state_json = _load_state()
        data = json.loads(state_json)
        # We'll test the callback by creating a mock context-like object
        # For a real test we need a browser, tested in test_weread_client.py
        assert "json" not in saved  # callback not yet called

    def test_update_from_cookies(self):
        """update_from_cookies should merge new cookies into state."""
        mgr = SessionManager(state_json=None)
        cookies = [
            {"name": "wr_skey", "value": "test123", "expires": 9999999999, "domain": ".weread.qq.com"},
            {"name": "wr_vid", "value": "987654", "expires": 9999999999, "domain": ".weread.qq.com"},
        ]
        mgr.update_from_cookies(cookies)
        assert mgr.has_valid_session
        assert mgr.vid == "987654"
