from pydantic import BaseModel


class Book(BaseModel):
    book_id: str
    title: str
    author: str | None = None
    translator: str | None = None
    cover: str | None = None
    intro: str | None = None
    isbn: str | None = None
    publisher: str | None = None
    publish_time: str | None = None
    total_words: int | None = None
    price: float | None = None
    category: str | None = None
    rating: int | None = None
    rating_detail: str | None = None
    finished: bool | None = None
    finish_reading: bool | None = None
