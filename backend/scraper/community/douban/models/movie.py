from pydantic import BaseModel


class Movie(BaseModel):
    title: str
    url: str
    cover: str | None = None
    release_date: str | None = None
    rating: int | None = None
    watch_date: str | None = None
    tags: list[str] | None = None
    comment: str | None = None
