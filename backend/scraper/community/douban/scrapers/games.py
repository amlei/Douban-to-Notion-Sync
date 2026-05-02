import re

from bs4 import BeautifulSoup

from .. import BASE_URL
from ..models.game import Game
from .base import BaseScraper, clean


def _parse_game_rating(class_name: str | None) -> int | None:
    if not class_name:
        return None
    m = re.search(r"allstar(\d)0", class_name)
    return int(m.group(1)) if m else None


class GamesScraper(BaseScraper):

    def _url(self, page_num: int) -> str:
        return f"{BASE_URL}/people/{self.user_id}/games?action=collect"

    def _parse_page(self, soup: BeautifulSoup) -> list[Game]:
        elements = soup.select(".common-item")
        games: list[Game] = []
        for el in elements:
            title_el = el.select_one(".title a")
            title = clean(title_el.get_text()).split("/")[0] if title_el else None
            url = title_el.get("href") if title_el else None
            img = el.select_one(".pic img")
            cover = img.get("src") if img else None
            desc_el = el.select_one(".desc")
            desc = clean(desc_el.get_text()) if desc_el else None
            rating_el = el.select_one(".rating-star")
            rating_cls = " ".join(rating_el.get("class", [])) if rating_el else None
            date_el = el.select_one(".date")
            play_date = clean(date_el.get_text()) if date_el else None
            tags_el = el.select_one(".tags")
            tags = tags_el.get_text().replace("标签: ", "").split() if tags_el else None
            comment = self._extract_game_comment(el)

            games.append(Game(
                title=title, url=url, cover=cover,
                desc=desc, rating=_parse_game_rating(rating_cls),
                play_date=play_date, tags=tags, comment=comment,
            ))
        return games

    @staticmethod
    def _extract_game_comment(el) -> str | None:
        content = el.select_one(".content")
        if not content:
            return None
        for child in content.select(":scope > div"):
            cls = child.get("class", [])
            cls_str = " ".join(cls) if isinstance(cls, list) else str(cls)
            if "title" not in cls_str and "desc" not in cls_str and "user-operation" not in cls_str:
                text = child.get_text(strip=True)
                if text:
                    return text
        return None
