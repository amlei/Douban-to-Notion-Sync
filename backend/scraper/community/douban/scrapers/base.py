import random
import re
import time
from typing import TypeVar

import requests
from bs4 import BeautifulSoup

T = TypeVar("T")


def clean(text: str | None) -> str | None:
    """Remove all whitespace. Return None for empty strings."""
    if text is None:
        return None
    cleaned = re.sub(r"\s+", "", text)
    return cleaned or None


class BaseScraper:
    """Base class for Douban scrapers with pagination support."""

    def __init__(self, http: requests.Session, user_id: str):
        self._http = http
        self._user_id = user_id

    @property
    def http(self) -> requests.Session:
        return self._http

    @property
    def user_id(self) -> str:
        return self._user_id

    def _url(self, page_num: int) -> str:
        raise NotImplementedError

    def _parse_page(self, soup: BeautifulSoup) -> list:
        raise NotImplementedError

    def _get_total_pages(self, soup: BeautifulSoup) -> int:
        """Read total pages from .paginator (last link number)."""
        paginator = soup.select_one(".paginator")
        if not paginator:
            return 1
        links = paginator.select("a")
        if not links:
            return 1
        last_text = links[-1].get_text(strip=True)
        try:
            return int(last_text)
        except ValueError:
            return 1

    def _fetch_soup(self, url: str) -> BeautifulSoup:
        resp = self._http.get(url)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")

    def scrape(self, max_pages: int = 1, existing_urls: set[str] | None = None) -> list:
        items: list = []
        total_pages = 1
        for page_num in range(1, 100_000):
            url = self._url(page_num)
            soup = self._fetch_soup(url)
            if page_num == 1:
                total_pages = self._get_total_pages(soup)
            effective_max = min(max_pages, total_pages) if max_pages > 0 else total_pages
            page_items = self._parse_page(soup)
            if existing_urls is not None:
                new_items = [i for i in page_items if getattr(i, "url", None) not in existing_urls]
                items.extend(new_items)
                if len(new_items) < len(page_items):
                    break
            else:
                items.extend(page_items)
            if page_num >= effective_max:
                break
            time.sleep(random.uniform(3, 6))
        return items
