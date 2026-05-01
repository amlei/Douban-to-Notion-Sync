from __future__ import annotations

import hashlib
import json
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.community.douban.models import Book, Game, Movie, Note, Profile as DoubanProfile, Review
from src.community.flomo.models import FlomoMemo
from src.community.flomo.models import Profile as FlomoProfile
from src.community.weread.models import Bookmark as WereadBookmark
from src.community.weread.models import Book as WereadBook
from src.community.weread.models import Profile as WereadProfile
from db.models import PLATFORM_DOUBAN, PLATFORM_FLOMO, PLATFORM_WEREAD

# Union type for save_binding -- accepts Douban, Flomo, or WeRead Profile
AnyProfile = DoubanProfile | WereadProfile | FlomoProfile

from .models import (
    BookRow,
    CommunityMeta,
    FlomoMemoRow,
    GameRow,
    MovieRow,
    NoteRow,
    ReviewRow,
    BookmarkRow,
)


class CommunityMetaRepo:
    @staticmethod
    async def get_binding(
        db: AsyncSession, user_id: int, platform_id: int
    ) -> CommunityMeta | None:
        stmt = select(CommunityMeta).where(
            CommunityMeta.user_id == user_id,
            CommunityMeta.platform_id == platform_id,
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def save_binding(
        db: AsyncSession,
        user_id: int,
        platform_id: int,
        community_user_id: str,
        profile: AnyProfile,
    ) -> CommunityMeta:
        existing = await CommunityMetaRepo.get_binding(db, user_id, platform_id)
        if existing is not None:
            existing.bound = 1
            existing.community_user_id = community_user_id
            existing.profile_json = profile.model_dump_json()
            await db.flush()
            return existing

        row = CommunityMeta(
            user_id=user_id,
            platform_id=platform_id,
            bound=1,
            community_user_id=community_user_id,
            profile_json=profile.model_dump_json(),
        )
        db.add(row)
        await db.flush()
        return row

    @staticmethod
    async def delete_binding(
        db: AsyncSession, user_id: int, platform_id: int
    ) -> None:
        row = await CommunityMetaRepo.get_binding(db, user_id, platform_id)
        if row is not None:
            await db.delete(row)
            await db.flush()

    @staticmethod
    async def save_session_state(
        db: AsyncSession,
        user_id: int,
        platform_id: int,
        state_json: str,
        expires_at: str | None,
    ) -> None:
        row = await CommunityMetaRepo.get_binding(db, user_id, platform_id)
        if row is not None:
            row.session_state_json = state_json
            row.session_expires_at = expires_at
            await db.flush()

    @staticmethod
    async def get_session_state(
        db: AsyncSession, user_id: int, platform_id: int
    ) -> tuple[str | None, str | None]:
        row = await CommunityMetaRepo.get_binding(db, user_id, platform_id)
        if row is None:
            return None, None
        return row.session_state_json, row.session_expires_at


def _book_row_hash(values: dict) -> str:
    """Compute change hash from a values dict, matching BookRow.change_hash()."""
    payload = f"{values.get('status') or ''}|{values.get('rating') or ''}|{values.get('external') or ''}"
    return hashlib.md5(payload.encode()).hexdigest()


class DataRepo:
    @staticmethod
    async def _upsert_book_rows(
        db: AsyncSession,
        user_id: int,
        platform_id: int,
        rows: list[dict],
        skip_unchanged: bool = False,
    ) -> dict:
        """Core upsert for book rows. Each dict maps BookRow column names to values.
        Returns {"total": N, "updated": M, "unchanged": K}."""
        if skip_unchanged:
            stmt = select(BookRow).where(
                BookRow.user_id == user_id,
                BookRow.platform_id == platform_id,
            )
            existing_rows = (await db.execute(stmt)).scalars().all()
            existing_map: dict[str, BookRow] = {row.url: row for row in existing_rows}

        updated = 0
        unchanged = 0
        for values in rows:
            if skip_unchanged:
                existing = existing_map.get(values["url"])
                if existing is not None and existing.change_hash() == _book_row_hash(values):
                    unchanged += 1
                    continue

            stmt = insert(BookRow).values(user_id=user_id, platform_id=platform_id, **values)
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "url", "platform_id"],
                set_={k: stmt.excluded[k] for k in values},
            )
            await db.execute(stmt)
            updated += 1
        await db.flush()
        return {"total": len(rows), "updated": updated, "unchanged": unchanged}

    @staticmethod
    async def upsert_books(db: AsyncSession, user_id: int, items: list[Book]) -> dict:
        rows = []
        for item in items:
            rows.append({
                "title": item.title, "url": item.url, "cover": item.cover,
                "author": item.author, "country": item.country,
                "translator": item.translator, "publisher": item.publisher,
                "pub_date": item.pub_date, "price": item.price,
                "rating": item.rating, "read_date": item.read_date,
                "status": item.status,
                "tags": json.dumps(item.tags, ensure_ascii=False) if item.tags else None,
                "comment": item.comment,
            })
        return await DataRepo._upsert_book_rows(db, user_id, PLATFORM_DOUBAN, rows)

    @staticmethod
    async def upsert_weread_books(
        db: AsyncSession, user_id: int, items: list[WereadBook]
    ) -> dict:
        rows = []
        for item in items:
            ext = json.dumps({
                "isbn": item.isbn,
                "category": item.category,
                "intro": item.intro,
                "publish_time": item.publish_time,
                "total_words": item.total_words,
                "rating_detail": item.rating_detail,
                "finished": 1 if item.finished else (0 if item.finished is False else None),
                "bookmark_synckey": 0,
            }, ensure_ascii=False)
            rows.append({
                "title": item.title, "url": item.book_id, "cover": item.cover,
                "author": item.author, "translator": item.translator,
                "publisher": item.publisher,
                "price": str(item.price) if item.price is not None else None,
                "rating": item.rating,
                "status": "1" if item.finish_reading else ("0" if item.finish_reading is False else None),
                "external": ext,
            })
        return await DataRepo._upsert_book_rows(
            db, user_id, PLATFORM_WEREAD, rows, skip_unchanged=True
        )

    @staticmethod
    async def get_bookmark_synckeys(
        db: AsyncSession, user_id: int
    ) -> dict[str, int]:
        """Return {book_id: bookmark_synckey} for all weread books of this user."""
        stmt = select(BookRow.url, BookRow.external).where(
            BookRow.user_id == user_id,
            BookRow.platform_id == PLATFORM_WEREAD,
        )
        rows = (await db.execute(stmt)).all()
        result = {}
        for url, ext_json in rows:
            ext = json.loads(ext_json) if ext_json else {}
            result[url] = ext.get("bookmark_synckey", 0)
        return result

    @staticmethod
    async def update_bookmark_synckey(
        db: AsyncSession, user_id: int, book_id: str, synckey: int
    ) -> None:
        stmt = select(BookRow).where(
            BookRow.user_id == user_id,
            BookRow.platform_id == PLATFORM_WEREAD,
            BookRow.url == book_id,
        )
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row is not None:
            ext = json.loads(row.external) if row.external else {}
            ext["bookmark_synckey"] = synckey
            row.external = json.dumps(ext, ensure_ascii=False)
            await db.flush()

    @staticmethod
    async def upsert_movies(
        db: AsyncSession, user_id: int, items: list[Movie]
    ) -> int:
        count = 0
        for item in items:
            tags_json = json.dumps(item.tags, ensure_ascii=False) if item.tags else None
            stmt = insert(MovieRow).values(
                user_id=user_id,
                title=item.title,
                url=item.url,
                cover=item.cover,
                release_date=item.release_date,
                rating=item.rating,
                watch_date=item.watch_date,
                tags=tags_json,
                comment=item.comment,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "url"],
                set_={
                    "title": stmt.excluded.title,
                    "cover": stmt.excluded.cover,
                    "release_date": stmt.excluded.release_date,
                    "rating": stmt.excluded.rating,
                    "watch_date": stmt.excluded.watch_date,
                    "tags": stmt.excluded.tags,
                    "comment": stmt.excluded.comment,
                },
            )
            await db.execute(stmt)
            count += 1
        await db.flush()
        return count

    @staticmethod
    async def upsert_games(
        db: AsyncSession, user_id: int, items: list[Game]
    ) -> int:
        count = 0
        for item in items:
            tags_json = json.dumps(item.tags, ensure_ascii=False) if item.tags else None
            stmt = insert(GameRow).values(
                user_id=user_id,
                title=item.title,
                url=item.url,
                cover=item.cover,
                desc=item.desc,
                rating=item.rating,
                release_date=item.release_date,
                play_date=item.play_date,
                tags=tags_json,
                comment=item.comment,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "url"],
                set_={
                    "title": stmt.excluded.title,
                    "cover": stmt.excluded.cover,
                    "desc": stmt.excluded.desc,
                    "rating": stmt.excluded.rating,
                    "release_date": stmt.excluded.release_date,
                    "play_date": stmt.excluded.play_date,
                    "tags": stmt.excluded.tags,
                    "comment": stmt.excluded.comment,
                },
            )
            await db.execute(stmt)
            count += 1
        await db.flush()
        return count

    @staticmethod
    async def upsert_reviews(
        db: AsyncSession, user_id: int, items: list[Review]
    ) -> int:
        count = 0
        for item in items:
            stmt = insert(ReviewRow).values(
                user_id=user_id,
                subject_title=item.subject_title,
                subject_url=item.subject_url,
                subject_img_url=item.subject_img_url,
                review_title=item.review_title,
                review_url=item.review_url,
                date=item.date,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "review_url"],
                set_={
                    "subject_title": stmt.excluded.subject_title,
                    "subject_url": stmt.excluded.subject_url,
                    "subject_img_url": stmt.excluded.subject_img_url,
                    "review_title": stmt.excluded.review_title,
                    "date": stmt.excluded.date,
                },
            )
            await db.execute(stmt)
            count += 1
        await db.flush()
        return count

    @staticmethod
    async def upsert_notes(
        db: AsyncSession, user_id: int, items: list[Note]
    ) -> int:
        count = 0
        for item in items:
            stmt = insert(NoteRow).values(
                user_id=user_id,
                title=item.title,
                url=item.url,
                date=item.date,
                location=item.location,
                body=item.body,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "url"],
                set_={
                    "title": stmt.excluded.title,
                    "date": stmt.excluded.date,
                    "location": stmt.excluded.location,
                    "body": stmt.excluded.body,
                },
            )
            await db.execute(stmt)
            count += 1
        await db.flush()
        return count

    @staticmethod
    async def get_books(db: AsyncSession, user_id: int) -> Sequence[BookRow]:
        stmt = select(BookRow).where(BookRow.user_id == user_id)
        return (await db.execute(stmt)).scalars().all()

    @staticmethod
    async def get_movies(db: AsyncSession, user_id: int) -> Sequence[MovieRow]:
        stmt = select(MovieRow).where(MovieRow.user_id == user_id)
        return (await db.execute(stmt)).scalars().all()

    @staticmethod
    async def get_games(db: AsyncSession, user_id: int) -> Sequence[GameRow]:
        stmt = select(GameRow).where(GameRow.user_id == user_id)
        return (await db.execute(stmt)).scalars().all()

    @staticmethod
    async def get_reviews(db: AsyncSession, user_id: int) -> Sequence[ReviewRow]:
        stmt = select(ReviewRow).where(ReviewRow.user_id == user_id)
        return (await db.execute(stmt)).scalars().all()

    @staticmethod
    async def get_notes(db: AsyncSession, user_id: int) -> Sequence[NoteRow]:
        stmt = select(NoteRow).where(NoteRow.user_id == user_id)
        return (await db.execute(stmt)).scalars().all()

    @staticmethod
    async def upsert_flomo_memos(
        db: AsyncSession, user_id: int, items: list[FlomoMemo]
    ) -> dict:
        """Upsert flomo memos, skipping unchanged ones.

        Returns {"total": N, "updated": M, "unchanged": K}.
        """
        # Load existing memos for change detection
        stmt = select(FlomoMemoRow).where(
            FlomoMemoRow.user_id == user_id,
            FlomoMemoRow.platform_id == PLATFORM_FLOMO,
        )
        existing_rows = (await db.execute(stmt)).scalars().all()
        existing_map: dict[str, FlomoMemoRow] = {
            r.memo_created_at: r for r in existing_rows
        }

        updated = 0
        unchanged = 0
        for item in items:
            tags_json = json.dumps(item.tags, ensure_ascii=False) if item.tags else None
            files_json = json.dumps(item.files, ensure_ascii=False) if item.files else None
            existing = existing_map.get(item.memo_created_at)
            if (
                existing is not None
                and existing.content == item.content
                and existing.tags == tags_json
                and existing.files == files_json
            ):
                unchanged += 1
                continue
            stmt = insert(FlomoMemoRow).values(
                user_id=user_id,
                platform_id=PLATFORM_FLOMO,
                content=item.content,
                tags=tags_json,
                files=files_json,
                memo_created_at=item.memo_created_at,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "platform_id", "memo_created_at"],
                set_={
                    "content": stmt.excluded.content,
                    "tags": stmt.excluded.tags,
                    "files": stmt.excluded.files,
                },
            )
            await db.execute(stmt)
            updated += 1
        await db.flush()
        return {"total": len(items), "updated": updated, "unchanged": unchanged}

    @staticmethod
    async def get_flomo_memos(db: AsyncSession, user_id: int) -> Sequence[FlomoMemoRow]:
        stmt = select(FlomoMemoRow).where(FlomoMemoRow.user_id == user_id)
        return (await db.execute(stmt)).scalars().all()


class BookmarkRepo:
    @staticmethod
    async def upsert_bookmarks(
        db: AsyncSession, user_id: int, items: list[WereadBookmark]
    ) -> int:
        count = 0
        for item in items:
            stmt = insert(BookmarkRow).values(
                user_id=user_id,
                platform_id=PLATFORM_WEREAD,
                book_id=item.book_id,
                book_title=item.book_title,
                mark_text=item.mark_text,
                chapter_name=item.chapter_name,
                chapter_idx=item.chapter_idx,
                style=item.style,
                create_time=item.create_time,
                bookmark_id=item.bookmark_id,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "platform_id", "book_id", "bookmark_id"],
                set_={
                    "mark_text": stmt.excluded.mark_text,
                    "chapter_name": stmt.excluded.chapter_name,
                    "chapter_idx": stmt.excluded.chapter_idx,
                    "style": stmt.excluded.style,
                    "create_time": stmt.excluded.create_time,
                    "book_title": stmt.excluded.book_title,
                },
            )
            await db.execute(stmt)
            count += 1
        await db.flush()
        return count

    @staticmethod
    async def get_bookmarks(db: AsyncSession, user_id: int) -> Sequence[BookmarkRow]:
        stmt = select(BookmarkRow).where(BookmarkRow.user_id == user_id)
        return (await db.execute(stmt)).scalars().all()
