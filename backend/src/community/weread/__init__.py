"""WeRead (weread.qq.com) scraper module."""

BASE_URL = "https://weread.qq.com/"

from .client import WeReadClient
from .login import WeReadLogin
from .models import Bookmark, Book, Profile
from .session import SessionManager

__all__ = [
    "Bookmark",
    "Book",
    "Profile",
    "SessionManager",
    "WeReadClient",
    "WeReadLogin",
]
