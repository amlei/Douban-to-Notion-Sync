import re

from bs4 import BeautifulSoup

from ..models.book import Book
from .base import BaseScraper, clean

_ITEMS_PER_PAGE = 15


def _parse_pub(text: str) -> dict:
    parts = [s.strip() for s in text.split("/")]
    n = len(parts)
    author = parts[0] if n >= 1 else None
    translator = parts[1] if n == 5 else None
    publisher = parts[2] if n == 5 else (parts[1] if n >= 3 else None)
    pub_date = parts[3] if n == 5 else (parts[2] if n >= 3 else (parts[1] if n == 2 else None))
    price = parts[4] if n == 5 else (parts[3] if n == 4 else None)
    return {"author": author, "translator": translator, "publisher": publisher, "pub_date": pub_date, "price": price}


def _extract_country(author: str | None) -> tuple[str | None, str | None]:
    if not author:
        return None, None
    m = re.match(r"[\[【](.+?)[\]】]\s*(.*)", author)
    if m:
        country = m.group(1)
        if "国" not in country:
            country += "国"
        return country, m.group(2).strip() or None
    return "中国", author


def _parse_date_status(text: str | None) -> tuple[str | None, str | None]:
    if not text:
        return None, None
    m = re.search(r"(读过|在读|想读)", text)
    status = m.group(1) if m else None
    date = re.sub(r"\s*(读过|在读|想读)\s*", "", text).strip() or None
    return date, status


def _parse_rating(class_name: str | None) -> int | None:
    if not class_name:
        return None
    m = re.search(r"rating(\d)", class_name)
    return int(m.group(1)) if m else None


class BooksScraper(BaseScraper):

    def _url(self, page_num: int) -> str:
        start = (page_num - 1) * _ITEMS_PER_PAGE
        return f"https://book.douban.com/people/{self.user_id}/collect?start={start}"

    def _parse_page(self, soup: BeautifulSoup) -> list[Book]:
        elements = soup.select(".subject-item")
        books: list[Book] = []
        for el in elements:
            title_el = el.select_one("h2 a")
            title = clean(title_el.get_text()).split("/")[0] if title_el else None
            url = title_el.get("href") if title_el else None
            img = el.select_one(".pic img")
            cover = img.get("src") if img else None
            pub_el = el.select_one(".pub")
            pub = _parse_pub(clean(pub_el.get_text()) or "") if pub_el else {}
            country, author = _extract_country(pub.get("author"))
            rating_el = el.select_one("[class*=rating]")
            rating_cls = " ".join(rating_el.get("class", [])) if rating_el else None
            date_el = el.select_one(".date")
            date_text = date_el.get_text() if date_el else None
            read_date, status = _parse_date_status(date_text)
            tags_el = el.select_one(".tags")
            tags = tags_el.get_text().replace("标签: ", "").split() if tags_el else None
            comment_el = el.select_one(".comment")
            comment = clean(comment_el.get_text()) if comment_el else None

            books.append(Book(
                title=title, url=url, cover=cover,
                author=author, country=country,
                translator=pub.get("translator"), publisher=pub.get("publisher"),
                pub_date=pub.get("pub_date"), price=pub.get("price"),
                rating=_parse_rating(rating_cls),
                date=read_date, status=status,
                tags=tags, comment=comment,
            ))
        return books
