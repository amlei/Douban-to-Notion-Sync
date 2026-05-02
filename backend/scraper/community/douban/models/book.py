from pydantic import BaseModel


class Book(BaseModel):
    title: str
    url: str
    cover: str | None = None
    author: str | None = None
    country: str | None = None
    translator: str | None = None
    publisher: str | None = None
    pub_date: str | None = None
    price: str | None = None
    rating: int | None = None
    read_date: str | None = None
    status: str | None = None
    tags: list[str] | None = None
    comment: str | None = None
