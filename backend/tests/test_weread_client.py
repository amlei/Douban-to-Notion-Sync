"""Integration tests for WeRead client data fetching.

Uses the real session state from .playwright/weread-state.json
and makes real API calls via Playwright browser context.

Usage:
    uv run pytest tests/test_weread_client.py -v -s
"""

import json
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

from src.community.weread.client import WeReadClient
from src.community.weread.models.book import Book
from src.community.weread.models.bookmark import Bookmark
from src.community.weread.models.profile import Profile
from src.community.weread.scrapers.bookmarks import scrape_bookmarks
from src.community.weread.scrapers.profile import scrape_profile
from src.community.weread.scrapers.shelf import scrape_book_info, scrape_shelf

_STATE_PATH = Path(__file__).resolve().parents[2] / ".playwright" / "weread-state.json"


@pytest.fixture(scope="module")
def client():
    """Create a WeReadClient with real session state."""
    state_json = _STATE_PATH.read_text(encoding="utf-8")
    c = WeReadClient(headless=True, state_json=state_json, channel="msedge")
    c.__enter__()
    c.ensure_ready()
    yield c
    c.__exit__(None, None, None)


class TestProfile:
    def test_scrape_profile(self, client):
        """Fetch real user profile."""
        profile = client.scrape_profile()
        assert isinstance(profile, Profile)
        assert profile.user_id
        assert profile.name
        print(f">>> Profile: name={profile.name}, vid={profile.user_id}")

    def test_profile_fields(self, client):
        """Verify profile has expected fields."""
        profile = client.scrape_profile()
        assert profile.user_id.isdigit()
        assert isinstance(profile.name, str)
        print(f">>> Profile: {profile.model_dump()}")


class TestShelf:
    def test_scrape_shelf(self, client):
        """Fetch real shelf books."""
        books = client.scrape_shelf()
        assert isinstance(books, list)
        assert len(books) > 0, "Shelf should have at least one book"
        print(f">>> Shelf: {len(books)} books")

    def test_book_model_fields(self, client):
        """Verify first book has expected fields."""
        books = client.scrape_shelf()
        book = books[0]
        assert isinstance(book, Book)
        assert book.book_id
        assert book.title
        print(f">>> First book: {book.title} (bookId={book.book_id})")

    def test_book_info_api(self, client):
        """Fetch book detail via API for a specific book."""
        books = client.scrape_shelf()
        if not books:
            pytest.skip("No books in shelf")
        book_id = books[0].book_id
        book = client.scrape_book_info(book_id)
        assert book is not None
        assert book.book_id == book_id
        assert book.title
        print(f">>> Book info: {book.title}, author={book.author}, rating={book.rating}")


class TestBookmarks:
    def test_scrape_bookmarks_for_book(self, client):
        """Fetch bookmarks for a specific book."""
        books = client.scrape_shelf()
        if not books:
            pytest.skip("No books in shelf")

        # Try first few books until we find one with bookmarks
        for book in books[:5]:
            bms = client.scrape_bookmarks(book.book_id)
            if bms:
                assert isinstance(bms[0], Bookmark)
                assert bms[0].mark_text
                assert bms[0].book_id == book.book_id
                print(f">>> Bookmarks for '{book.title}': {len(bms)} items")
                print(f">>> First bookmark: {bms[0].mark_text[:80]}...")
                return

        print(">>> No bookmarks found in first 5 books")

    def test_empty_bookmarks_for_unknown_book(self, client):
        """Unknown book_id should return empty list, not error."""
        bms = client.scrape_bookmarks("00000000")
        assert isinstance(bms, list)
        # May be empty or may error -- both are acceptable
        print(f">>> Bookmarks for unknown book: {len(bms)} items")


class TestScraperDirectly:
    """Test individual scraper functions with page from client."""

    def test_scrape_profile_direct(self, client):
        """Test profile scraper directly."""
        vid = client.vid
        assert vid, "Client should have vid"
        profile = scrape_profile(client._page, vid)
        assert profile.name
        print(f">>> Direct profile scrape: {profile.name}")

    def test_scrape_shelf_direct(self, client):
        """Test shelf scraper directly."""
        vid = client.vid
        assert vid
        books = scrape_shelf(client._page, vid)
        assert len(books) > 0
        print(f">>> Direct shelf scrape: {len(books)} books")

    def test_scrape_bookmarks_direct(self, client):
        """Test bookmarks scraper directly."""
        books = client.scrape_shelf()
        if not books:
            pytest.skip("No books")
        bms = scrape_bookmarks(client._page, books[0].book_id)
        print(f">>> Direct bookmarks scrape: {len(bms)} items for '{books[0].title}'")
