# Frontend Architecture Adjustment Plan

## Context

CLAUDE.md defines frontend conventions, but the actual project has drifted:
- `components.json` uses `"style": "new-york"` — switch to **Luma** preset
- `globals.css` uses older radius formula, missing shadcn import
- Minor directory structure issues (hook in workspace/ instead of core/)

## Phase 1: Switch to Luma Preset

1. `bunx shadcn@latest init --preset luma --force` — updates components.json, globals.css, reinstalls all UI components
2. Re-apply local customizations (sidebar TooltipProvider wrapper)
3. Re-add project-specific CSS (custom @source directives, animations, sky colors)
4. Update CLAUDE.md: change `base-nova` → `luma` (radix base)

## Phase 2: Directory Structure

1. Move `src/components/workspace/use-settings-dialog.tsx` → `src/core/settings/settings-dialog-context.tsx`
2. Update imports in workspace-sidebar.tsx and workspace-content.tsx
3. Remove empty `src/app/api/auth/ws-token/` directory

## Phase 3: Verification

- `bun run build && bun run lint`
- Visual check: sidebar, dialogs, forms, dark mode toggle
