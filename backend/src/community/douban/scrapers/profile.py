import re

from bs4 import BeautifulSoup, NavigableString

from .. import BASE_URL
from ..models.profile import Profile
from .base import BaseScraper, clean


class ProfileScraper(BaseScraper):

    def _url(self, page_num: int) -> str:
        return f"{BASE_URL}/people/{self.user_id}/"

    def scrape(self, max_pages: int = 1) -> Profile:
        url = self._url(1)
        soup = self._fetch_soup(url)

        # Name: first text node in h1 (signature div is nested inside h1)
        name = None
        h1 = soup.select_one("h1")
        if h1:
            for child in h1.children:
                if isinstance(child, NavigableString):
                    t = str(child).strip()
                    if t:
                        name = t
                        break

        # Avatar
        avatar = None
        img = soup.select_one(".basic-info img.userface")
        if img:
            avatar = img.get("src")

        # Signature (inside h1 > #edit_signature)
        signature = None
        sig_display = soup.select_one("#edit_signature #display")
        if sig_display:
            signature = sig_display.get_text(strip=True) or None

        # Bio / intro
        bio = None
        intro_el = soup.select_one("#edit_intro")
        if intro_el:
            intro_display = intro_el.select_one("#intro_display")
            if intro_display:
                bio = intro_display.get_text(strip=True) or None

        # Join date and location from .user-info .pl
        join_date = None
        location = None
        user_info_pl = soup.select_one(".user-info .pl")
        if user_info_pl:
            text = user_info_pl.get_text()
            m = re.search(r"(\d{4}-\d{2}-\d{2})加入", text)
            if m:
                join_date = m.group(1)
            m = re.search(r"IP属地：(\S+)", text)
            if m:
                location = m.group(1)

        return Profile(
            user_id=self.user_id,
            name=name,
            avatar=avatar,
            signature=signature,
            bio=bio,
            join_date=join_date,
            location=location,
        )
