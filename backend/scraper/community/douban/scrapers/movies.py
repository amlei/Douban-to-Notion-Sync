import re

from bs4 import BeautifulSoup

from ..models.movie import Movie
from .base import BaseScraper, clean
from .books import _parse_rating

_ITEMS_PER_PAGE = 15


class MoviesScraper(BaseScraper):

    def _url(self, page_num: int) -> str:
        start = (page_num - 1) * _ITEMS_PER_PAGE
        return f"https://movie.douban.com/people/{self.user_id}/collect?start={start}"

    def _parse_page(self, soup: BeautifulSoup) -> list[Movie]:
        elements = soup.select(".item")
        movies: list[Movie] = []
        for el in elements:
            title_el = el.select_one(".title a")
            title = clean(title_el.get_text()).split("/")[0] if title_el else None
            url = title_el.get("href") if title_el else None
            img = el.select_one(".pic img")
            cover = img.get("src") if img else None
            intro_el = el.select_one(".intro")
            intro_text = clean(intro_el.get_text()) if intro_el else None
            date_info = intro_text.split("/")[0].split("(")[0] if intro_text else None
            rating_el = el.select_one("[class*=rating]")
            rating_cls = " ".join(rating_el.get("class", [])) if rating_el else None
            date_el = el.select_one(".date")
            date = clean(date_el.get_text()) if date_el else None
            tags_el = el.select_one(".tags")
            tags = tags_el.get_text().replace("标签: ", "").split() if tags_el else None
            comment_el = el.select_one(".comment")
            comment = clean(comment_el.get_text()) if comment_el else None

            movies.append(Movie(
                title=title, url=url, cover=cover,
                release_date=date_info,
                rating=_parse_rating(rating_cls),
                watch_date=date, tags=tags, comment=comment,
            ))
        return movies
