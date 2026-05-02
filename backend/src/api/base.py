from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class BindTask:
    task_id: str
    platform: str
    status: Literal["pending", "scanned", "logged_in", "fetching_profile", "scraping", "bound", "failed"] = "pending"
    qr_base64: str | None = None
    user_id: str | None = None
    profile: object | None = None
    error: str | None = None
    scrape_phase: str | None = None
    scrape_counts: dict = field(default_factory=dict)
    event: asyncio.Event = field(default_factory=asyncio.Event)
    _loop: asyncio.AbstractEventLoop | None = field(default=None, repr=False)

    def bind_loop(self) -> None:
        self._loop = asyncio.get_running_loop()

    def _notify(self) -> None:
        if self._loop is None:
            return
        self._loop.call_soon_threadsafe(self._set_and_clear)

    def _set_and_clear(self) -> None:
        self.event.set()
        self.event.clear()


def supported_platforms() -> list[str]:
    return ["douban", "weread", "flomo"]
