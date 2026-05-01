from bs4 import BeautifulSoup

from .. import BASE_URL
from ..models.note import Note
from .base import BaseScraper, clean


class NotesScraper(BaseScraper):

    def _url(self, page_num: int) -> str:
        start = (page_num - 1) * 10
        return f"{BASE_URL}/people/{self._user_id}/notes?start={start}&type=note"

    def _parse_page(self, soup: BeautifulSoup) -> list[Note]:
        elements = soup.select(".note-item")
        notes: list[Note] = []
        for el in elements:
            a = el.select_one(".note-title a")
            title = clean(a.get_text()) if a else None
            url = a.get("href") if a else None

            date_el = el.select_one(".note-date")
            date = clean(date_el.get_text()) if date_el else None

            location_el = el.select_one(".note-location")
            location = clean(location_el.get_text()) if location_el else None

            body_el = el.select_one(".note-body")
            body = body_el.get_text(strip=True) if body_el else None

            notes.append(Note(title=title, url=url, date=date, location=location, body=body))
        return notes
