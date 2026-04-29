from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from db.engine import get_session
from db.models import User
from src.core.auth.auth import (
    check_password_strength,
    create_access_token,
    generate_verification_code,
    verify_password,
)
from src.core.auth.deps import get_current_user
from src.core.utils.email import send_verification_code
from src.core.auth.repository import AuthRepo, store_code, verify_code

router = APIRouter()


class AuthReq(BaseModel):
    action: str
    # register / login / verify
    email: EmailStr | None = None
    # login / verify
    password: str | None = None
    # verify
    code: str | None = None
    # update-profile
    name: str | None = None
    avatar: str | None = None
    bio: str | None = None
    # change-password
    old_password: str | None = None
    new_password: str | None = None


def _get(req: AuthReq, field: str) -> str:
    val = getattr(req, field)
    if val is None:
        raise HTTPException(status_code=422, detail=f"缺少参数: {field}")
    return val


@router.post("")
async def auth_handler(
    req: AuthReq,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    action = req.action

    if action == "register":
        email = _get(req, "email")
        existing = await AuthRepo.get_active_user_by_email(db, email)
        if existing:
            raise HTTPException(status_code=409, detail="该邮箱已注册")
        code = generate_verification_code()
        await store_code(email, code)
        try:
            await send_verification_code(email, code)
        except Exception:
            raise HTTPException(status_code=500, detail="邮件发送失败，请检查 SMTP 配置")
        return {"message": "验证码已发送"}

    if action == "verify":
        email = _get(req, "email")
        code = _get(req, "code")
        password = _get(req, "password")
        if len(password) < 6:
            raise HTTPException(status_code=422, detail="密码至少需要 6 个字符")
        if not await verify_code(email, code):
            raise HTTPException(status_code=400, detail="验证码无效或已过期")
        new_user = await AuthRepo.create_user(db, email, password)
        token = create_access_token(new_user.user_id, new_user.id)
        tips = check_password_strength(password)
        return {"access_token": token, "user": new_user.to_api_dict(), "password_tips": tips or None}

    if action == "login":
        email = _get(req, "email")
        password = _get(req, "password")
        found = await AuthRepo.get_active_user_by_email(db, email)
        if found is None or not verify_password(password, found.password_hash):
            raise HTTPException(status_code=401, detail="邮箱或密码错误")
        token = create_access_token(found.user_id, found.id)
        return {"access_token": token, "user": found.to_api_dict()}

    # --- actions below require authentication ---
    if user is None:
        raise HTTPException(status_code=401, detail="未登录")

    if action == "mine":
        return user.to_api_dict()

    if action == "update-profile":
        updated = await AuthRepo.update_profile(db, user, req.name, req.avatar, req.bio)
        return updated.to_api_dict()

    if action == "change-password":
        old_pw = _get(req, "old_password")
        new_pw = _get(req, "new_password")
        if not verify_password(old_pw, user.password_hash):
            raise HTTPException(status_code=401, detail="原密码错误")
        if len(new_pw) < 6:
            raise HTTPException(status_code=422, detail="新密码至少需要 6 个字符")
        await AuthRepo.update_password(db, user, new_pw)
        tips = check_password_strength(new_pw)
        return {"message": "密码已修改", "password_tips": tips or None}

    if action == "delete":
        await AuthRepo.soft_delete(db, user)
        return {"message": "账号已注销"}

    raise HTTPException(status_code=400, detail=f"未知操作: {action}")
