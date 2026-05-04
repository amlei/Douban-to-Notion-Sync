# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LifeInk AI -- a personal data aggregator that scrapes book/movie/memo data from Douban, WeRead, and Flomo, and provides an AI chat interface. The project has two main subsystems: a legacy `requests`-based Notion syncer at the root, and a newer backend + frontend stack in `backend/` and `frontend/`.

## Development Commands

### Backend (Go API Server)

```bash
cd backend
go run main.go                     # Start Go API server (port 8000)
go build -o lifeink-api .          # Build binary
go test ./... -v                   # Run tests
```

### Python Scraper Service (Playwright)

```bash
cd backend/scraper
pip install -r requirements.txt
python -m playwright install chromium   # first time only
uvicorn server:app --port 50051          # start scraper microservice
```

### Frontend (Next.js App Router + Bun)

```bash
cd frontend
bun install           # install dependencies
bun run dev           # start dev server (http://localhost:3000, Turbopack)
bun run build         # production build
bun run lint          # run ESLint
bun run start         # preview production build
```

### One-command startup

```bash
# Terminal 1: Python scraper service
cd backend/scraper && uvicorn server:app --port 50051

# Terminal 2: Go API server
cd backend && go run main.go

# Terminal 3: Frontend
cd frontend && bun run dev
```

Note: The frontend uses Next.js App Router with Turbopack dev server on port 3000. REST API calls go through Next.js Route Handlers (`src/app/api/`) that act as a BFF layer for cookie management. Only WebSocket connections are proxied directly via `next.config.js` rewrites. The env var `INTERNAL_BACKEND_URL` (defaults to `http://127.0.0.1:8000`) configures the backend address.

### Root project (legacy Notion sync)

```bash
pip install -r requirements.txt
python main.py              # Syncs books to Notion (incremental)
```

No test suite or linter for the root project.

## Architecture

### Backend (`backend/`)

Go (Gin) API server + Python (FastAPI) scraper microservice.

```
Frontend (React)  <-->  Go API Server (Gin, :8000)  <-->  PostgreSQL
                            |
                            +---> Redis (verification codes + JWT tokens)
                            |
                            +---> Python Scraper Service (FastAPI, :50051)
                                    |
                                    +---> Playwright (msedge)
```

**Go API Server** -- handles all HTTP/WebSocket, auth, email, Redis, PostgreSQL:
- `main.go` -- entrypoint, wires all handlers and middleware
- `internal/config/` -- YAML config loading (SMTP presets, Redis, PostgreSQL, JWT)
- `internal/database/` -- PostgreSQL init + seed (`postgres.go`, Bun ORM + pgdriver, no auto-migration) and Redis operations (`redis.go`, verification codes + JWT tokens)
- `internal/middleware/` -- JWT auth middleware (cookie-first, Bearer fallback) + CORS (dynamic origin with credentials)
- `internal/email/` -- SMTP email sending with HTML template
- `pkg/auth/` -- Auth handler (register/verify/login/mine/update-profile/change-password/delete), JWT service, user repo
- `pkg/community/` -- Platform binding, sync orchestration, data models + repos, WebSocket handler (`ws.go`), task coordination (`task.go`). Per-platform subdirectories:
  - `pkg/community/douban/` -- `models.go`, `repo.go`
  - `pkg/community/weread/` -- `models.go`, `repo.go`
  - `pkg/community/flomo/` -- `models.go`, `parser.go` (HTML/zip export parsing), `repo.go`
- `pkg/scraper/` -- HTTP client to Python scraper service (SSE stream parsing)
- `pkg/chat/` -- Mock chat streaming handler

Legacy Python code in `backend/src/` and `backend/db/` has been removed.

**Python Scraper Service** (`backend/scraper/`):
- FastAPI microservice on port 50051 (internal only, not exposed to frontend)
- `server.py` -- 5 endpoints: `POST /bind` (SSE), `POST /sync` (SSE), `POST /refresh`, `POST /unbind` (logout before unbinding), `GET /health`
- Reuses existing `douban/`, `weread/`, `flomo/` scraper code
- Returns scraped data via SSE events (no DB access -- Go writes to PostgreSQL)
- Platform identifiers: `PLATFORM_DOUBAN=1`, `PLATFORM_WEREAD=2`, `PLATFORM_FLOMO=3`

**Database** (PostgreSQL):
- Bun ORM with pgdriver. No auto-migration in Go code -- PostgreSQL schema must exist before startup.
- Tables: `platforms`, `users`, `community_meta`, `books`, `movies`, `games`, `reviews`, `notes`, `bookmarks`, `flomo_memos`
- All `user_id` foreign keys reference `users.id` with `CASCADE` delete.
- Models have `ToAPIDict()` methods for API responses. `ChangeHash()` on BookRow avoids unnecessary updates.

**Redis**: Verification codes (`vc:{email}`, 10min TTL) + JWT tokens (`jwt:{user_id}`, 24h TTL) for server-side session management.

**API endpoints**:
- `POST /api/auth` -- auth actions (register/verify/login/mine/update-profile/change-password/delete)
- `POST /api/chat` -- streaming text response (mock LLM)
- `POST /api/community/bind?action=...&platform=...` -- platform bind/unbind/status/refresh
- `POST /api/community/sync?platform=...` -- trigger data sync
- `WS /api/community/ws?platform=...` -- WebSocket progress (auth via cookie or subprotocol)
- `GET /api/community/data?platform=all` -- retrieve all platform data

### Frontend (`frontend/`)

Bun-managed Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4.

- **App Router structure** (`src/app/`):
  - `layout.tsx` -- root layout with `ThemeProvider` (next-themes)
  - `page.tsx` -- redirects to `/workspace`
  - `api/` -- Route Handlers (BFF layer): `auth/route.ts`, `chat/route.ts`, `community/{bind,sync,data}/route.ts`. Each forwards requests to Go backend with cookie passthrough; `auth` handler sets/clears httpOnly `access_token` cookie.
  - `(auth)/layout.tsx` -- auth guard: redirects authenticated users to `/workspace`
  - `(auth)/login/page.tsx` -- login/registration page (email verification code flow)
  - `workspace/layout.tsx` -- workspace guard: redirects unauthenticated users to `/login`
  - `workspace/workspace-content.tsx` -- `QueryClientProvider` + `SidebarProvider` + sidebar + main content
  - `workspace/chat/new/page.tsx` -- welcome screen with chat input
  - `workspace/chat/[id]/page.tsx` -- chat page with `@ai-sdk/react` streaming
  - `workspace/settings/page.tsx` -- settings tabs (general, account, data, terms)
  - `workspace/settings/sync/page.tsx` -- platform binding/sync page
  - `workspace/settings/data/page.tsx` -- data viewer (books/movies/notes/memos)
- **Core business logic** (`src/core/`):
  - `api/client.ts` -- fetch wrapper with `credentials: "include"` for cookie-based auth
  - `api/auth.ts` -- auth API functions (register/verify/login/logout/profile)
  - `api/community.ts` -- community API + WebSocket (cookie-based auth)
  - `auth/types.ts` -- Zod `userSchema`, `AuthResult` tagged union
  - `auth/server.ts` -- `getServerSideUser()` reads cookie, calls backend for validation
  - `auth/AuthProvider.tsx` -- client auth context with `{ user, isAuthenticated, logout, refreshUser }`
  - `community/types.ts` -- `BindStatus`, `PollResult`, `BookItem`, `MovieItem`, etc.
  - `community/queries.ts` -- TanStack Query hooks for community data and bindings
  - `community/use-platform-binding.ts` -- platform binding state machine with WebSocket
  - `chat/use-chat-store.ts` -- in-memory chat state (Map cache)
  - `utils/password.ts` -- password strength checking
- **UI components** (`src/components/`):
  - `ui/` -- 30+ Radix UI + CVA components (button, input, dialog, tabs, sidebar, etc.)
  - `workspace/` -- feature components (sidebar, chat, settings panels, data views)
  - `theme-provider.tsx` -- next-themes wrapper
  - `query-client-provider.tsx` -- TanStack Query provider
- **Styling**: Tailwind CSS v4 with oklch color system, `class`-based dark mode via next-themes
- **Auth**: Cookie-based (httpOnly `access_token`), server-side auth guards in layouts
- **API routing**: REST calls go through Next.js Route Handlers (`src/app/api/auth/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/community/{bind,sync,data}/route.ts`) that forward to Go backend, managing httpOnly cookies server-side. WebSocket is the only direct proxy via `next.config.js` rewrites.
- UI is in Chinese

### Root: Legacy Notion Sync Pipeline

`main.py` -> `function/spider.py` -> `function/glo.py`

1. `Glo` class (`function/glo.py`) loads all config from `.env` at import time via `python-dotenv`.
2. `Book` class (`function/spider.py`) scrapes Douban HTML with `requests` + BeautifulSoup. `Video` extends `Book`, overriding `title()`, `other()`, `cover_link()`.
3. `BookRun`/`VideoRun` (`main.py`) orchestrate: scrape -> create Notion page -> populate properties from JSON templates -> update page.
4. Incremental sync: reads last synced title from `last mark/new_{book,video}.txt`, stops when that title is encountered.

## Key Conventions

- All Notion property names in JSON templates and code are Chinese.
- The root scraper uses `requests`; the Go backend delegates scraping to a Python microservice using Playwright. They do not share code.
- `last mark/`, `.playwright/`, `.playwright-cli/`, `backend/db/data/`, and `tmp/` are gitignored (contain user-specific session data and databases).
- `backend/config.yaml` is gitignored (contains SMTP and PostgreSQL credentials).
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

`backend/config.yaml` (gitignored, for auth + Redis + PostgreSQL):

- `smtp.provider` -- preset name (`qq`, `outlook`, `163`, `126`, `yeah`, `custom`)
- `smtp.username`, `smtp.password` -- SMTP credentials
- `redis.host`, `redis.port`, `redis.db`, `redis.password` -- Redis config (defaults to localhost:6379)
- `postgres.host`, `postgres.port`, `postgres.user`, `postgres.password`, `postgres.dbname`, `postgres.sslmode` -- PostgreSQL config
- `jwt_secret` -- JWT signing key (auto-generated if empty)
- `scraper_url` -- Python scraper service address (defaults to `http://127.0.0.1:50051`)

## CI/CD

- `.github/workflows/pages.yml` -- deploys a GitHub Pages site
- `.github/workflows/auto-merge.yml` -- auto-merge with squash for repository owner PRs, after Python syntax checks on both root and backend modules
