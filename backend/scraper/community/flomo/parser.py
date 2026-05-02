"""Parse Flomo exported HTML into structured memo objects."""

from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

from .models import FlomoMemo


def parse_export(zip_path: str | Path) -> list[FlomoMemo]:
    """Extract and parse all memos from a Flomo export zip.

    Returns memos ordered from oldest to newest (same as the HTML).
    """
    with zipfile.ZipFile(zip_path) as zf:
        # Find the HTML file inside the zip
        html_name = next(n for n in zf.namelist() if n.endswith(".html"))
        html = zf.read(html_name).decode("utf-8")

    return parse_html(html)


def parse_html(html: str) -> list[FlomoMemo]:
    """Parse memos from Flomo exported HTML content."""
    memos: list[FlomoMemo] = []
    parts = html.split('<div class="memo">')

    for part in parts[1:]:  # skip everything before first memo
        end = part.find("</div>\n    </div>")
        if end == -1:
            # fallback: find closing of the memo container
            end = part.find('<div class="memo">')
            if end == -1:
                end = len(part)
        fragment = part[:end]

        # Extract time
        time_match = re.search(r'<div class="time">(.*?)</div>', fragment)
        if not time_match:
            continue
        memo_time = time_match.group(1).strip()

        # Extract content div
        content_match = re.search(
            r'<div class="content">(.*?)</div>\s*<div class="files',
            fragment,
            re.DOTALL,
        )
        if not content_match:
            content_match = re.search(
                r'<div class="content">(.*?)</div>\s*</div>',
                fragment,
                re.DOTALL,
            )
        if not content_match:
            continue
        content_html = content_match.group(1).strip()

        # Extract tags (#xxx patterns from text)
        text_content = re.sub(r"<[^>]+>", "", content_html)
        tags = re.findall(r"#[\u4e00-\u9fff\w/]+", text_content)

        # Extract file paths
        files = re.findall(r'<img\s+src="(file/[^"]+)"', fragment)

        memos.append(FlomoMemo(
            content=content_html,
            tags=tags,
            files=files,
            memo_created_at=memo_time,
        ))

    # HTML lists newest first; reverse to oldest first
    memos.reverse()
    return memos
