from pydantic import BaseModel


class Profile(BaseModel):
    user_id: str
    name: str | None = None
    avatar: str | None = None
    gender: int | None = None
    signature: str | None = None
    location: str | None = None
