from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from src.core.utils.config import get_config, save_config

_JWT_ALGORITHM = "HS256"
_JWT_EXPIRE_MINUTES = 1440


def _get_jwt_secret() -> str:
    cfg = get_config()
    if cfg.jwt_secret:
        return cfg.jwt_secret
    secret = secrets.token_hex(32)
    cfg.jwt_secret = secret
    save_config()
    return secret


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def check_password_strength(password: str) -> list[str]:
    tips: list[str] = []
    if len(password) < 6:
        tips.append("密码至少需要 6 个字符")
    if not any(c.isupper() for c in password):
        tips.append("建议包含大写字母")
    if not any(c.islower() for c in password):
        tips.append("建议包含小写字母")
    if not any(c.isdigit() for c in password):
        tips.append("建议包含数字")
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?`~" for c in password):
        tips.append("建议包含特殊字符")
    return tips


def create_access_token(user_id: str, user_pk: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=_JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "pk": user_pk, "exp": expire}
    return jwt.encode(payload, _get_jwt_secret(), algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, _get_jwt_secret(), algorithms=[_JWT_ALGORITHM])


def generate_user_id() -> str:
    return uuid.uuid4().hex[:16]


def generate_verification_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"
