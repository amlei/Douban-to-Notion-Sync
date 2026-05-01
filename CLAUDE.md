# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LifeInk AI -- a personal data aggregator that scrapes book/movie/memo data from Douban, WeRead, and Flomo, and provides an AI chat interface. The project has two main subsystems: a legacy `requests`-based Notion syncer at the root, and a newer backend + frontend stack in `backend/` and `frontend/`.

## Development Commands

### Backend (FastAPI + Playwright scraper)

```bash
cd backend
uv sync
uv run python -m playwright install chromium   # first time only
uv run python __main__.py --type books --pages 3   # CLI scraper
uv run python __main__.py --type browser           # open interactive browser with saved session
uv run python src/api.py                           # start API server (port 8000)
uv run pytest tests/ -v -s                         # run all tests
uv run pytest tests/test_weread_client.py -v -s    # run a single test file
uv run pytest tests/test_weread_client.py::test_name -v -s  # run a single test
```

Valid `--type` values: `profile`, `books`, `movies`, `games`, `reviews`, `notes`, `browser`.

Backend config (SMTP for email verification): copy `config-example.yaml` to `config.yaml` and fill in credentials.

### Frontend (React + Vite + Bun)

```bash
cd frontend
bun install           # install dependencies
bun run dev           # start dev server (http://localhost:5173)
bun run build         # production build
bun run lint          # run ESLint
bun run preview       # preview production build
```

### One-command startup

```bash
./start.sh            # starts backend (uv) + frontend (bun run dev) concurrently
```

### Root project (legacy Notion sync)

```bash
pip install -r requirements.txt
python main.py              # Syncs books to Notion (incremental)
```

No test suite or linter for the root project.

## Architecture

### Backend (`backend/`)

Independent `uv`-managed project (Python >=3.12). Four layers:

**API layer** (`src/api.py`, `src/api/`):
- FastAPI app with `AuthMiddleware` + CORS. Started via `uvicorn` on port 8000.
- `POST /api/chat` -- streaming text response (mock LLM, character-by-character).
- `POST /api/community/bind?action=...&platform=...` -- platform bind/unbind/status/refresh. Requires auth.
- `POST /api/community/sync?platform=...` -- trigger data sync for a bound platform. Requires auth.
- `WS /api/community/ws?token=...&platform=...` -- WebSocket push of binding/sync progress. Auth via query param.
- `GET /api/community/data?platform=...` -- retrieve books, movies, notes, bookmarks, or memos for a platform. Requires auth.
- Each platform has its own `BindManager` subclass in `src/api/`: `AsyncBindManager` for Douban (`douban.py`), `WereadBindManager` (`weread.py`), `FlomoBindManager` (`flomo.py`). They run Playwright login in a thread pool, notifying the WebSocket via `asyncio.Event`.

**Auth layer** (`src/core/`):
- JWT (HS256, 24h expiry, secret auto-generated or set in `config.yaml`) with bcrypt password hashing.
- `AuthMiddleware` (`src/core/middleware.py`): validates Bearer token on all routes except whitelist (`/api/auth/*`, `/api/chat`, `/docs`). Injects `User` into `request.state.user`.
- `AuthRepo` (`src/core/auth/repository.py`): user CRUD, soft delete.
- Verification codes: 6-digit, 10min expiry, stored in **Redis** (`src/core/utils/redis.py`), not the database.
- Auth routes (`src/core/auth/routes.py`): register -> email verification code -> verify+create account -> login returns JWT. Also `/me`, `/change-password`, `/delete`.
- Email via `src/core/utils/email.py` using SMTP config from `config.yaml` (presets for qq, outlook, 163, 126, yeah).
- `src/core/utils/config.py`: loads `config.yaml` (Pydantic model with `SmtpConfig`, `RedisConfig`, `jwt_secret`).

**Scraper layer** (`src/community/`):
- Platform identifiers are integer constants: `PLATFORM_DOUBAN=1`, `PLATFORM_WEREAD=2`, `PLATFORM_FLOMO=3` (defined in `db/models.py`).
- **Douban** (`douban/`): `DoubanClient` uses Playwright for QR login + `requests.Session` for data scraping. Auto-detects `user_id` from `/mine/` redirect. `SessionManager` builds session from saved Playwright cookies.
- **WeRead** (`weread/`): `WereadClient` uses full browser automation (`page.evaluate` + `fetch`) for API calls. Scrapers for shelf, bookmarks, and profile. Session restored from Playwright storage state.
- **Flomo** (`flomo/`): `FlomoClient` uses browser automation to export notes/memos via Flomo's HTML export, parsed by `parser.py`. `SessionManager` restores from Playwright storage state.
- `BaseScraper` (`douban/scrapers/base.py`): pagination base class. Subclasses implement `_url()` and `_parse_page()`.
- Each data type has a Pydantic model and scraper: Book, Movie, Game, Review, Note, Profile (Douban); Book, Bookmark, Profile (WeRead); FlomoMemo (Flomo).
- Default browser channel is `msedge`.

**Database layer** (`db/`):
- SQLAlchemy async ORM over SQLite (`aiosqlite`). DB file: `backend/db/data/lifeink.db`.
- `engine.py`: async engine, session factory, `init_db()`.
- `models.py`: ORM models -- `PlatformRow` (platform enumeration), `User` (email, password_hash, name, avatar, bio, status, email_verified), `CommunityMeta` (platform binding + session state), `BookRow` (shared by Douban and WeRead, with `platform_id` and `external` JSON field), `MovieRow`, `GameRow`, `ReviewRow`, `NoteRow`, `BookmarkRow` (WeRead), `FlomoMemoRow` (Flomo, stores HTML content, tags, files). Row models have `to_api_dict()` and `to_pydantic()` methods. `change_hash()` on row models avoids unnecessary updates.
- `repository.py`: `CommunityMetaRepo` (binding/session CRUD), `DataRepo` (upsert + get for each data type, using SQLite `ON CONFLICT DO UPDATE`; includes `upsert_flomo_memos`), `BookmarkRepo` (WeRead bookmarks), `AuthRepo` (user CRUD).
- All `user_id` foreign keys reference `users.id` with `CASCADE` delete.

### Frontend (`frontend/`)

Bun-managed React 19 + TypeScript + Vite.

- `App.tsx` wraps everything in `AuthProvider`. Renders `Sidebar`, `ChatPanel`/`WelcomeScreen`, and a right panel placeholder. `ProfileModal` for settings.
- `AuthContext` (`contexts/AuthContext.tsx`): global auth state with JWT token storage in localStorage, auto-logout on 401, `authedFetch()` wrapper.
- `AuthModal` (`components/profile/AuthModal.tsx`): login + registration with email verification code flow and password strength indicator.
- `ProfileModal` (`components/profile/ProfileModal.tsx`): tabbed modal with `AccountTab`, `DataTab`, and platform binding via `usePlatformBinding` hook.
- `useChatStore` hook manages chat state (messages, history, active chat) with in-memory `Map` cache.
- `ChatPanel` uses `@ai-sdk/react`'s `useChat` hook with `TextStreamChatTransport` for streaming.
- `api/auth.ts` provides auth API calls; `api/douban.ts` provides platform-agnostic REST and WebSocket functions for platform binding and data access (despite the filename, it handles all platforms).
- `types/community.ts` defines shared types: `BindStatus`, `PollResult`, `BookItem`, `MovieItem`, `NoteItem`, `BookmarkItem`, `MemoItem`, `CommunityData`.
- Vite dev server proxies `/api` (including WebSocket) to `http://localhost:8000`.
- UI is in Chinese.

### Root: Legacy Notion Sync Pipeline

`main.py` -> `function/spider.py` -> `function/glo.py`

1. `Glo` class (`function/glo.py`) loads all config from `.env` at import time via `python-dotenv`.
2. `Book` class (`function/spider.py`) scrapes Douban HTML with `requests` + BeautifulSoup. `Video` extends `Book`, overriding `title()`, `other()`, `cover_link()`.
3. `BookRun`/`VideoRun` (`main.py`) orchestrate: scrape -> create Notion page -> populate properties from JSON templates -> update page.
4. Incremental sync: reads last synced title from `last mark/new_{book,video}.txt`, stops when that title is encountered.

## Key Conventions

- All Notion property names in JSON templates and code are Chinese.
- The root scraper uses `requests`; the backend uses Playwright (for login) + `requests` (for scraping). They do not share code.
- `last mark/`, `.playwright/`, `.playwright-cli/`, `backend/db/data/`, and `tmp/` are gitignored (contain user-specific session data and databases).
- `backend/config.yaml` is gitignored (contains SMTP credentials).
- Strictly prohibited from using emojis in code or comments.
- All files created for temporary use shall be placed in the `tmp/` directory.
- Creating .sh and other script files is prohibited.
- Frontend modal components must not use horizontal divider lines (e.g. `border-top`, `border-bottom`, `<hr>`) for visual separation. Use spacing, background color, or other non-line styling instead.

## API Design Convention

All API endpoints use a **unified single-endpoint pattern**: one URL per domain, distinguished by action.

**Patterns:**
- Auth routes: `action` field in POST body (e.g. `POST /api/auth` with `{"action": "login", ...}`)
- Community routes: `action` and `platform` as query params (e.g. `POST /api/community/bind?action=start&platform=douban`)

## Required Configuration

`.env` file at project root (gitignored, for legacy Notion sync only):

- `TOKEN` -- Notion integration token
- `BOOK_DATABASE_ID`, `VIDEO_DATABASE_ID` -- Notion database IDs
- `COOKIE` -- Douban session cookie (root scraper only)
- `DOUBANID` -- Douban user ID
- `USER_AGENT`, `ACCEPT` -- HTTP headers for Douban requests
- `BOOK_ICON`, `VIDEO_ICON` -- icon URLs for Notion pages
- `STAR` -- character used to display ratings

`backend/config.yaml` (gitignored, for auth + Redis):

- `smtp.provider` -- preset name (`qq`, `outlook`, `163`, `126`, `yeah`, `custom`)
- `smtp.username`, `smtp.password` -- SMTP credentials
- `redis.host`, `redis.port`, `redis.db`, `redis.password` -- Redis config (defaults to localhost:6379)
- `jwt_secret` -- JWT signing key (auto-generated if empty)

## CI/CD

- `.github/workflows/pages.yml` -- deploys a GitHub Pages site
- `.github/workflows/auto-merge.yml` -- auto-merge with squash for repository owner PRs, after Python syntax checks on both root and backend modules
