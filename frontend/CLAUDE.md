# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js 16 (App Router) web app built with React 19, Shadcn UI 4, and Tailwind CSS 4. Package manager is **bun** — never use npm or yarn.

> If adding Electron desktop support, see `reference/electron.md` for desktop-specific conventions.

## Build & Dev Commands

```bash
bun install                        # Install dependencies
bun run dev                        # Start Next.js dev server
bun run build                      # Production build
bun run lint                       # ESLint
```

No test framework is configured yet.

## Architecture

**Path alias:** `@/*` → `./src/*`

### Key Directories

- `src/app/` — Next.js App Router pages and layouts
- `src/components/` — Cross-page reusable components only (e.g. `ui/`, `ai-elements/`, shared layout components)
- `src/components/workspace/` — Page-specific UI components only (styling/layout, no business logic). Each component is a single file (e.g. `src/components/workspace/github-icon.tsx`, `src/components/workspace/todo-list.tsx`). If a component is complex enough to need sub-components, use a directory (e.g. `src/components/workspace/chat-message/index.tsx`).
- `src/core/` — Business logic layer for pages (counterpart to `workspace/`). Organized by feature domain — each domain is a directory containing its own API calls, interfaces, types, hooks, and logic. `workspace/` handles UI; `core/` handles the underlying functionality.
  - `src/core/api/` — API proxy and shared request utilities
  - `src/core/utils/` — Shared business utilities
- `src/lib/` — Generic utilities (`utils.ts` has `cn()` helper)
- `docs/` — Project documentation (e.g. `shadcn-ui.md`, `ui-design/`)

### Shadcn UI

Config in `components.json` — uses `luma` preset (radix base), CSS variables, Lucide icons. Add components via `bunx shadcn@latest add <name>`. Do not manually edit files in `src/components/ui/`. **Always use Shadcn UI components instead of developing new basic components from scratch.** If a needed component does not exist in `src/components/ui/`, install it via the `shadcn` CLI first.

### AI Elements

`src/components/ai-elements/` is the AI feature component library (not page components). Before creating a new component, first analyze whether it can be composed from existing Shadcn UI base components (e.g. `Button`, `Card`, `Avatar`, `Tooltip`, `Badge`, etc.). Build on top of Shadcn UI primitives rather than reimplementing basic UI patterns. Only add AI-specific styling and behavior as the customization layer.

Page-specific components belong in `src/components/workspace/` (e.g. `src/components/workspace/github-icon.tsx`, `src/components/workspace/todo-list.tsx`).

## Important Notes

- Next.js 16 has breaking changes from earlier versions. Check `node_modules/next/dist/docs/` before using unfamiliar APIs.
