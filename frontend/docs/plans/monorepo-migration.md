# Monorepo Migration Plan

## Current State

```
lifeink-ai/
├── frontend/          # Next.js 16 (Bun + Turbopack)
│   ├── src/components/ui/    # shadcn UI 组件 (luma preset)
│   └── src/core/             # 业务逻辑
├── backend/           # Go API + Python Scraper
│   ├── pkg/                  # Go 业务逻辑
│   └── scraper/              # Python FastAPI 微服务
└── (legacy files)     # Notion 同步等
```

- 1 个前端 app，Go/Python 后端独立运行
- 无根级 workspace 配置（无 `turbo.json`、Bun workspaces 未启用）
- 各服务独立包管理：`bun` / `go modules` / `uv`

## 目标结构

monorepo 在 `frontend/` 内部完成，不涉及仓库根目录。

```
lifeink-ai/
├── frontend/                       # ← Bun workspace 根
│   ├── apps/
│   │   ├── web/                    # Next.js 主应用
│   │   │   ├── app/
│   │   │   ├── components/         # 页面级组件（workspace/, ai-elements/）
│   │   │   ├── core/               # 业务逻辑
│   │   │   ├── components.json     # ui alias → @lifeink/ui/components
│   │   │   └── package.json
│   │   └── miniapp/                # Phase 5: 微信小程序（Taro/uni-app）
│   │       ├── components.json
│   │       └── package.json
│   ├── packages/
│   │   └── ui/                     # 共享 UI 组件库
│   │       ├── src/
│   │       │   ├── components/     # shadcn UI 组件
│   │       │   ├── hooks/          # 共享 hooks（use-mobile 等）
│   │       │   ├── lib/            # cn() 等工具
│   │       │   └── styles/
│   │       │       └── globals.css # 共享主题变量
│   │       ├── components.json
│   │       └── package.json        # name: "@lifeink/ui"
│   ├── package.json                # Bun workspace 配置
│   ├── turbo.json                  # Turborepo 构建图
│   └── bun.lock                    # 统一 lockfile
├── backend/                        # Go + Python（不变）
└── (legacy files)
```

## 触发条件

**不要提前迁移。** 以下条件满足任一即可启动：

- Phase 5 微信小程序开发启动，需要 web 和小程序共享 UI 组件
- 需要独立的组件库包给其他前端项目使用
- 团队有多个前端 app 的明确需求

现阶段只有 1 个前端 app，迁移的 ROI 不够。

## 迁移步骤

### Phase 1: 初始化 Monorepo

```bash
cd frontend
bunx shadcn@latest init --monorepo --preset luma
```

或手动创建：

```bash
cd frontend
mkdir -p apps packages/ui/src
# 在 frontend/ 下创建根 package.json + turbo.json
```

### Phase 2: 提取 packages/ui

1. 将 `frontend/src/components/ui/` 移至 `frontend/packages/ui/src/components/`
2. 将 `frontend/src/lib/utils.ts` 移至 `frontend/packages/ui/src/lib/utils.ts`
3. 将 `frontend/src/hooks/use-mobile.ts` 移至 `frontend/packages/ui/src/hooks/`
4. 将 `frontend/src/styles/globals.css` 移至 `frontend/packages/ui/src/styles/`

### Phase 3: 配置 packages/ui

`packages/ui/package.json`:
```json
{
  "name": "@lifeink/ui",
  "private": true,
  "type": "module",
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts",
    "./hooks/*": "./src/hooks/*.ts"
  }
}
```

`packages/ui/components.json`:
```json
{
  "style": "radix-luma",
  "aliases": {
    "components": "@lifeink/ui/components",
    "utils": "@lifeink/ui/lib/utils",
    "ui": "@lifeink/ui/components"
  }
}
```

### Phase 4: 迁移 apps/web

1. `frontend/src/` → `frontend/apps/web/src/`
2. 更新 `apps/web/components.json`:
   ```json
   {
     "aliases": {
       "components": "@/components",
       "ui": "@lifeink/ui/components",
       "utils": "@lifeink/ui/lib/utils"
     }
   }
   ```
3. 全局替换 import 路径：`@/components/ui/` → `@lifeink/ui/components/`
4. `globals.css` 改为从 `@lifeink/ui/globals.css` 导入

### Phase 5: Turborepo 配置

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] }
  }
}
```

`frontend/package.json`（Bun workspaces 根）:
```json
{
  "name": "lifeink-ai",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": { "turbo": "^2" },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint"
  }
}
```

Bun 原生支持 `workspaces` 字段，无需 `pnpm-workspace.yaml`。`bun install` 自动解析 workspace 依赖，生成根级 `bun.lock`。

### Phase 6: 验证

```bash
cd frontend
bun install
bun run build
bun run dev
bun run lint
```

## 后端不受影响

Go + Python 后端保持在 `backend/`，不参与 JS/TS workspace：

- `go.mod` / `go.sum` 独立
- `backend/scraper/pyproject.toml` 独立
- 根 `.gitignore` 继续覆盖所有服务

## 风险与注意事项

- **import 路径变更量大**：需要全局替换 `@/components/ui/` → `@lifeink/ui/components/`
- **CSS 主题共享**：`globals.css` 移至 `packages/ui` 后，app 级自定义样式（动画、@source）需要保留在 `apps/web/`
- **shadcn CLI 兼容**：迁移后 `bunx shadcn@latest add` 需在 `apps/web/` 目录下执行，CLI 会自动路由到 `packages/ui/`
- **一次完成**：建议在一个 PR 内完成迁移，避免半迁移状态

## 参考

- [shadcn Monorepo Docs](https://ui.shadcn.com/docs/monorepo)
- [Turborepo](https://turbo.build/repo)
