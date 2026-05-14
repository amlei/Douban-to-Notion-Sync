# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LifeInk AI backend — a Go (Gin) API server + Python (FastAPI) scraper microservice. Aggregates personal data from Douban, WeRead, and Flomo via Playwright browser automation, stores in PostgreSQL, and provides AI chat with streaming LLM responses.

## Commands

```bash
# Go API server (http://localhost:8000)
cp config-example.yaml config.yaml   # configure SMTP/Redis/PostgreSQL/LLM first
go run main.go

# Generate Ent ORM code after schema changes
cd backend && go generate ./ent

# Python scraper microservice (http://localhost:50051, internal only)
cd backend/scraper
uv sync                              # managed by uv, uses pyproject.toml
uv run playwright install chromium   # first time only
uv run uvicorn server:app --port 50051
```

No test framework is currently set up.

## Architecture

### Go API Server (`main.go` → `:8000`)

**Two-layer structure:** `internal/` (infrastructure) and `pkg/` (business logic).

- `internal/config/` — Loads `config.yaml` (YAML). Access via `config.GetString()`, `config.Unmarshal()`. Auto-generates JWT secret on first run.
- `internal/database/` — Ent ORM client + raw `*sql.DB`. Auto-migrates on startup (`Schema.Create`). Seeds platform table (douban=1, weread=2, flomo=3).
- `internal/middleware/` — JWT auth (cookie or Bearer header, whitelist: `/api/auth`). CORS for localhost:3000/5173.
- `internal/task/` — Generic `Manager[T]` for per-user in-memory task tracking (bind/sync). Uses channel-based notification for WebSocket polling.
- `internal/ws/` — WebSocket handler with sub-protocol JWT auth. Polls task manager for real-time status updates.
- `pkg/auth/` — Handler/service/repo pattern. bcrypt passwords, JWT access/refresh tokens stored in Redis.
- `pkg/community/platform/` — Platform binding, sync orchestration, data models. Each platform (douban/, weread/, flomo/) has its own models and repo. Models use `ToAPIDict()` for API serialization and `ChangeHash()` for incremental sync detection.
- `pkg/chat/` — AI chat with SSE streaming. Manages sessions and messages via Ent ORM. Streams LLM responses with reasoning/text parts. Auto-generates session titles asynchronously.
- `community/openai/` — OpenAI-compatible HTTP client (`Chat` + `ChatStream`). Supports reasoning_content delta. Configured via `llm` section in config.yaml.

### API Design Pattern

All domains use a **single endpoint** with `action` field or query parameter:
- `POST /api/auth` — `action`: register, verify, login, mine, update-profile, change-password, delete
- `POST /api/community/bind?action=...&platform=...` — actions: status, start, refresh, delete
- `POST /api/chat?action=...` — actions: list, messages, delete, rename, batch-delete (empty action = send)

### Python Scraper Service (`scraper/` → `:50051`)

FastAPI microservice. Go backend calls it via HTTP; responses are SSE streams.

**Critical:** Uses `multiprocessing.Process` (not threads) for Playwright because sync Playwright API cannot run inside asyncio event loop (Playwright >=1.40). All subprocess functions are module-level for macOS `spawn`.

Each platform has: `client.py` (Playwright browser lifecycle), `login.py` (QR code login), `session.py` (cookie/state management), `scrapers/` (data extraction), `models/` (Pydantic models).

Endpoints: `POST /bind`, `POST /sync`, `POST /refresh`, `POST /unbind`, `GET /health`.

### Database (PostgreSQL + Ent ORM)

Ent schemas define all tables in `ent/schema/`. Run `go generate ./ent` after schema changes. Generated code lives in `ent/` (do not edit manually).

Key tables: `users`, `platforms`, `community_meta`, `books`, `movies`, `games`, `reviews`, `notes`, `bookmarks`, `flomo_memos`, `sessions`, `messages`.

### Inter-Service Communication

Go → Python scraper: HTTP with SSE streaming. Go's `pkg/scraper/` package parses SSE events from the scraper service. The scraper URL is configurable via `scraper_url` in config.yaml (default `http://127.0.0.1:50051`).

### External Dependencies

- **Redis** — verification codes (10min TTL), JWT token storage (24h TTL)
- **SMTP** — email verification codes (presets: qq/outlook/163/126/yeah)
- **LLM** — OpenAI-compatible API (default: Alibaba DashScope/qwen-plus). Configured in `llm` config section.

## Key Conventions

- Config is `config.yaml` (gitignored). Template: `config-example.yaml`.
- Ent ORM code generation: edit `ent/schema/*.go`, then `go generate ./ent`. Never edit generated `ent/*.go` files directly.
- Python dependencies managed by `uv` (`pyproject.toml`), not `pip/requirements.txt`.
- JWT authentication: supports both cookie (`access_token`) and `Authorization: Bearer` header.
- Platform IDs are fixed: douban=1, weread=2, flomo=3.
