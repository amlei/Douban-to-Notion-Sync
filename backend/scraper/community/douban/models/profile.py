from pydantic import BaseModel


class Profile(BaseModel):
    user_id: str
    name: str | None = None
    avatar: str | None = None
    signature: str | None = None
    bio: str | None = None
    join_date: str | None = None
    location: str | None = None
