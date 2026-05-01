from pydantic import BaseModel


class Game(BaseModel):
    title: str
    url: str
    cover: str | None = None
    desc: str | None = None
    rating: int | None = None
    release_date: str | None = None
    play_date: str | None = None
    tags: list[str] | None = None
    comment: str | None = None
