from __future__ import annotations

from playwright.sync_api import Page

from ..models.book import Book


def scrape_shelf(page: Page, vid: str) -> list[Book]:
    """Fetch shelf books from localStorage, then enrich missing fields via API."""
    raw = page.evaluate(
        """(vid) => {
            return localStorage.getItem('shelf:rawBooks:' + vid);
        }""",
        vid,
    )

    if not raw:
        return []

    import json

    items = json.loads(raw)
    books: list[Book] = []

    for item in items:
        book = _parse_book(item)
        if book:
            books.append(book)

    return books


def scrape_book_info(page: Page, book_id: str) -> Book | None:
    """Fetch single book detail via /web/book/info API."""
    data = page.evaluate(
        """async (bookId) => {
            const r = await fetch('/web/book/info?bookId=' + bookId);
            if (!r.ok) return null;
            return await r.json();
        }""",
        book_id,
    )
    if not data:
        return None
    return _parse_book(data)


def _parse_book(item: dict) -> Book | None:
    """Parse a book dict from shelf or API response into Book model."""
    book_id = item.get("bookId")
    if not book_id:
        return None

    rating_detail = None
    rating_info = item.get("newRatingDetail")
    if isinstance(rating_info, dict):
        rating_detail = rating_info.get("title")

    category = item.get("category")
    if not category:
        cats = item.get("categories")
        if isinstance(cats, list) and cats:
            category = cats[0].get("title")

    finished = item.get("finished")
    finish_reading = item.get("finishReading")

    return Book(
        book_id=str(book_id),
        title=item.get("title", ""),
        author=item.get("author"),
        translator=item.get("translator"),
        cover=item.get("cover"),
        intro=item.get("intro"),
        isbn=item.get("isbn"),
        publisher=item.get("publisher"),
        publish_time=item.get("publishTime"),
        total_words=item.get("totalWords"),
        price=item.get("price"),
        category=category,
        rating=item.get("newRating"),
        rating_detail=rating_detail,
        finished=bool(finished) if finished is not None else None,
        finish_reading=bool(finish_reading) if finish_reading is not None else None,
    )
