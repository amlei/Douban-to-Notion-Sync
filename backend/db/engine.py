from __future__ import annotations

from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .base import Base
from .models import User

_DB_DIR = Path(__file__).resolve().parent / "data"
_DB_PATH = _DB_DIR / "lifeink.db"

engine = create_async_engine(
    f"sqlite+aiosqlite:///{_DB_PATH}",
    echo=False,
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_default_user(db: AsyncSession) -> User:
    stmt = select(User).where(User.status == "active").limit(1)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def init_db() -> None:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Seed platforms table
        await conn.execute(
            text(
                "INSERT OR IGNORE INTO platforms (id, name) VALUES "
                "(1, 'douban'), (2, 'weread'), (3, 'flomo')"
            )
        )
