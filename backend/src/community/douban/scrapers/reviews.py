import re

from bs4 import BeautifulSoup

from .. import BASE_URL
from ..models.review import Review
from .base import BaseScraper, clean

_ITEMS_PER_PAGE = 10


class ReviewsScraper(BaseScraper):

    def _url(self, page_num: int) -> str:
        start = (page_num - 1) * _ITEMS_PER_PAGE
        return f"{BASE_URL}/people/{self.user_id}/reviews?start={start}"

    def _parse_page(self, soup: BeautifulSoup) -> list[Review]:
        elements = soup.select(".review-item")
        reviews: list[Review] = []
        for el in elements:
            subject_img = el.select_one(".subject-img img")
            subject_title = subject_img.get("title") if subject_img else None
            subject_a = el.select_one(".subject-img")
            subject_url = subject_a.get("href") if subject_a else None
            subject_img_url = subject_img.get("src") if subject_img else None
            h2a = el.select_one("h2 a")
            review_title = clean(h2a.get_text()) if h2a else None
            review_url = h2a.get("href") if h2a else None
            all_text = el.get_text() or ""
            m = re.search(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", all_text)
            date = m.group(1) if m else None

            reviews.append(Review(
                subject_title=subject_title,
                subject_url=subject_url,
                subject_img_url=subject_img_url,
                review_title=review_title,
                review_url=review_url,
                date=date,
            ))
        return reviews
