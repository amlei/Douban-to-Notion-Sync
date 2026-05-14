<div align="center">
  <img src="assets/Banner.png" alt="LifeInk AI" width="100%" />
</div>

# LifeInk AI

> Personal AI Agent - 聚合书影音日记，用 AI 重新理解你的生活。

LifeInk AI 从豆瓣、微信读书、Flomo 等平台采集个人的阅读、影视、游戏、日记等数据，通过 AI 进行对话分析、偏好洞察，并自动生成周报/月报/年度总结。

---

## 当前状态

### 用户系统

- [x] JWT 邮箱注册/登录（bcrypt 密码哈希）
- [x] 邮箱验证码（SMTP，预设 qq/outlook/163/126/yeah）
- [x] 个人资料编辑、密码修改、账号注销

### 数据源

- [x] 豆瓣 - 图书、影视、游戏、书评、日记、个人资料（Playwright）
- [x] 豆瓣 - 图书、影视同步至 Notion（requests）
- [x] 微信读书 - 书架、标注、个人资料（Playwright 浏览器自动化）
- [x] Flomo - 日记导出与同步（Playwright 浏览器自动化）

### 数据同步

- [x] 增量同步至 Notion 数据库（legacy）
- [x] 自动登录检测（session 过期弹二维码）
- [x] 翻页数据提取、图标/封面/评分
- [x] PostgreSQL 存储（Ent ORM，自动建表）
- [x] 绑定后自动抓取数据
- [x] WebSocket 实时推送绑定/同步进度

### AI Agent

- [x] 前端聊天界面（React + Next.js）
- [x] 流式响应（SSE + AI SDK）
- [x] Go API Server (Gin) + Python Scraper 微服务架构
- [x] AI 聊天对话（OpenAI 兼容 LLM，支持 reasoning_content）
- [x] 聊天会话持久化（Ent ORM）
- [x] 自动生成会话标题
- [ ] 基于个人数据的 AI Agent

---

## 项目结构

```
main.py              # Notion 同步入口（legacy）
function/            # Notion 同步相关（legacy）
json/                # Notion 数据库模板（legacy）
icon/                # 页面图标（legacy）

backend/             # API 服务 + 数据抓取
  main.go           # Go API Server (Gin) 入口
  ent/              # Ent ORM 生成代码（schema 定义在 ent/schema/）
  internal/         # 基础设施（config, database, email, middleware, task, ws）
  pkg/              # 业务逻辑
    auth/           # JWT 认证（注册/登录/验证码/密码重置）
    community/      # 平台绑定、同步编排、数据模型 + PostgreSQL CRUD
    scraper/        # Python Scraper HTTP 客户端（SSE 解析）
    chat/           # AI 聊天（会话管理、消息持久化、LLM 流式响应）
  community/
    openai/         # OpenAI 兼容 HTTP 客户端（Chat + ChatStream）
  scraper/          # Python Scraper 微服务（FastAPI，uv 管理）
    server.py       # FastAPI 应用（bind/sync/refresh/unbind/health）
    community/
      douban/       # 豆瓣（Playwright 登录 + requests 抓取）
      weread/       # 微信读书（Playwright 浏览器自动化）
      flomo/        # Flomo（Playwright 浏览器自动化 + HTML 导出解析）

frontend/            # Next.js 16 App Router 前端（Bun + Turbopack）
  src/app/           # 页面路由（App Router）
    (auth)/          # 登录/注册页
    workspace/       # 主工作区（聊天、设置、数据查看）
    api/             # Route Handlers（BFF 层，转发请求至 Go 后端）
  src/core/          # 核心业务逻辑
    api/             # API 客户端（auth, community）
    auth/            # 认证上下文与类型（AuthProvider, Zod schema）
    chat/            # 聊天状态管理
    community/       # 平台绑定/同步（TanStack Query, WebSocket）
    settings/        # 设置模块
    streamdown/      # Markdown 流式渲染
  src/components/    # UI 组件
    ui/              # Shadcn UI 基础组件
    ai-elements/     # AI 功能组件库
    workspace/       # 页面级 UI 组件
```

---

## 快速开始

### 一键启动

```bash
# 终端 1: Python Scraper 微服务
cd backend/scraper
uv sync                              # uv 管理依赖
uv run playwright install chromium   # 首次
uv run uvicorn server:app --port 50051

# 终端 2: Go API 服务器
cd backend
cp config-example.yaml config.yaml    # 配置 SMTP/Redis/PostgreSQL/LLM
go run main.go

# 终端 3: 前端
cd frontend
bun install
bun run dev
```

启动后：
- 前端: http://localhost:3000
- 后端: http://localhost:8000
- Scraper: http://localhost:50051/health

### 后端单独启动

```bash
cd backend
cp config-example.yaml config.yaml            # 配置 SMTP/Redis/PostgreSQL（注册功能需要 SMTP）
go run main.go
```

### Notion 同步（原有功能）

```bash
pip install -r requirements.txt
# 配置 .env（TOKEN、DATABASE_ID、COOKIE 等）
python main.py
```

---

## Roadmap

### Phase 1 - 数据采集 (current)

- [x] 豆瓣全量数据抓取
- [x] 本地数据持久化
- [x] 用户注册与登录系统
- [x] 微信读书数据接入
- [x] Flomo 数据接入

### Phase 2 - AI Agent

- [x] AI 对话接口（LLM 流式响应）
- [x] 聊天会话持久化
- [ ] 基于个人数据上下文的 AI 对话
- [ ] 阅读偏好分析与推荐
- [ ] 标签/分类智能整理
- [ ] 跨平台数据关联（读书笔记 vs 影评 vs 日记）

### Phase 3 - 自动报告

- [ ] 周报/月报/年报自动生成
- [ ] Markdown / PDF / Web 导出
- [ ] 报告模板自定义

### Phase 4 - 可视化看板

- [ ] 个人信息看板（阅读统计、观影记录、想法时间线）
- [ ] 阅读趋势图表（月度/年度）
- [ ] 书影音评分分布
- [ ] 标签词云与分类统计

### Phase 5 - 微信小程序

- [ ] 小程序项目初始化（原生 / Taro / uni-app）
- [ ] 微信登录（code2session + 后端 user 绑定）
- [ ] 数据看板页面（书影音统计、时间线）
- [ ] AI 对话页面（流式响应适配小程序 WebSocket）
- [ ] 平台绑定流程（小程序内扫码或跳转）
- [ ] 小程序发布与审核

---

## 参考

- [Notion API](https://www.notion.so/my-integrations)
- [Playwright](https://playwright.dev/python/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
