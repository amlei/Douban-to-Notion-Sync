from pydantic import BaseModel


class Note(BaseModel):
    title: str
    url: str | None = None
    date: str | None = None
    location: str | None = None
    body: str | None = None
