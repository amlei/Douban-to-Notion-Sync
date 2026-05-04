from pydantic import BaseModel


class Profile(BaseModel):
    user_id: str
    name: str | None = None
    avatar: str | None = None
    email: str | None = None
