from pydantic import BaseModel


class Review(BaseModel):
    subject_title: str
    subject_url: str | None = None
    subject_img_url: str | None = None
    review_title: str | None = None
    review_url: str | None = None
    date: str | None = None
