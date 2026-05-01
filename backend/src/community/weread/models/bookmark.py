from pydantic import BaseModel


class Bookmark(BaseModel):
    book_id: str
    book_title: str | None = None
    mark_text: str
    chapter_name: str | None = None
    chapter_idx: int | None = None
    style: int | None = None
    create_time: int | None = None
    bookmark_id: str | None = None
