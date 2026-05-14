# Frontend

Next.js 16 (App Router) 前端应用，基于 React 19、Shadcn UI 4 (luma preset)、Tailwind CSS 4。包管理器为 **bun**。

## 环境要求

- bun >= 1.0
- Node.js >= 20

## 快速开始

```bash
cd frontend
bun install
bun run dev        # http://localhost:3000，Turbopack 模式
```

## 脚本

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动开发服务器（Turbopack） |
| `bun run build` | 生产构建 |
| `bun run start` | 启动生产服务 |
| `bun run lint` | ESLint 检查 |

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19
- **UI 组件**: Shadcn UI 4（luma preset，Radix 基础）+ Lucide 图标
- **样式**: Tailwind CSS 4
- **状态**: TanStack React Query
- **AI**: Vercel AI SDK（`ai` + `@ai-sdk/react`）
- **表单**: React Hook Form + Zod 校验
- **图表**: Recharts
- **类型安全**: TypeScript 6

## 目录结构

```
src/
  app/                  # Next.js App Router 页面和布局
  components/
    ui/                 # Shadcn UI 基础组件（通过 CLI 管理，勿手动编辑）
    ai-elements/        # AI 功能组件库
    workspace/          # 页面级 UI 组件（仅样式/布局，不含业务逻辑）
  core/                 # 业务逻辑层
    api/                # API 代理和请求工具
    settings/           # 设置模块
    utils/              # 业务工具函数
  lib/                  # 通用工具（cn() 等）
  styles/               # 全局样式
```

路径别名 `@/*` → `./src/*`。

## Shadcn UI

通过 CLI 添加组件：

```bash
bunx shadcn@latest add <name>
```

配置文件为 `components.json`。不要手动编辑 `src/components/ui/` 中的文件。
