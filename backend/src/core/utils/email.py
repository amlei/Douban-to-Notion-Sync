from __future__ import annotations

import asyncio
import smtplib
from email.mime.text import MIMEText
from pathlib import Path

from src.core.utils.config import get_config

_TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"


def _render_template(name: str, **kwargs: str) -> str:
    html = (_TEMPLATES_DIR / name).read_text(encoding="utf-8")
    for key, value in kwargs.items():
        html = html.replace("{{" + key + "}}", value)
    return html


def _send(to_email: str, code: str) -> None:
    cfg = get_config().smtp.resolved()
    subject = "LifeInk AI - 验证码"
    html = _render_template("verification_code.html", code=code)
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = cfg["from_email"]
    msg["To"] = to_email

    if cfg.get("use_ssl"):
        with smtplib.SMTP_SSL(cfg["host"], cfg["port"]) as server:
            if cfg["username"]:
                server.login(cfg["username"], cfg["password"])
            server.sendmail(cfg["from_email"], [to_email], msg.as_string())
    else:
        with smtplib.SMTP(cfg["host"], cfg["port"]) as server:
            if cfg.get("use_tls"):
                server.starttls()
            if cfg["username"]:
                server.login(cfg["username"], cfg["password"])
            server.sendmail(cfg["from_email"], [to_email], msg.as_string())


async def send_verification_code(to_email: str, code: str) -> None:
    await asyncio.to_thread(_send, to_email, code)
