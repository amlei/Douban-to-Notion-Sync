from __future__ import annotations

from playwright.sync_api import Page

from ..models.profile import Profile


def scrape_profile(page: Page, vid: str) -> Profile:
    """Fetch user profile via /web/user API from browser context."""
    data = page.evaluate(
        """async (vid) => {
            const r = await fetch('/web/user?userVid=' + vid);
            if (!r.ok) return null;
            return await r.json();
        }""",
        vid,
    )
    if not data:
        raise RuntimeError(f"Failed to fetch profile for vid={vid}")

    return Profile(
        user_id=str(data.get("userVid", vid)),
        name=data.get("name"),
        avatar=data.get("avatar"),
        gender=data.get("gender"),
        signature=data.get("signature"),
        location=data.get("location"),
    )
