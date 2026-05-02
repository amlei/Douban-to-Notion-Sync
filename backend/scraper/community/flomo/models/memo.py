from pydantic import BaseModel


class FlomoMemo(BaseModel):
    """A single Flomo memo/note."""

    content: str  # raw HTML content
    tags: list[str]  # ["#tag1", "#tag2/sub"]
    files: list[str]  # relative image paths: ["file/2026-04-01/.../xxx.jpg"]
    memo_created_at: str  # original creation time: "2026-04-02 16:51:38"
