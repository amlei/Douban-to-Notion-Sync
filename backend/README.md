# Backend

Go (Gin) API 服务器 + Python (FastAPI) 数据抓取微服务。

## 环境要求

- Go >= 1.26
- Python >= 3.12
- PostgreSQL
- Redis（验证码 + JWT 存储）

## 快速开始

### Go API 服务器

```bash
cd backend

# 配置 SMTP / Redis / PostgreSQL / LLM
cp config-example.yaml config.yaml

# 启动（默认监听 :8000）
go run main.go
```

### Ent ORM 代码生成

修改 `ent/schema/` 后运行：

```bash
cd backend && go generate ./ent
```

### Python Scraper 微服务

```bash
cd backend/scraper

# 安装依赖（uv 管理，非 pip）
uv sync

# 安装浏览器（首次）
uv run playwright install chromium

# 启动（默认监听 :50051，仅供 Go 后端内部调用）
uv run uvicorn server:app --port 50051
```

## API

Go API 服务器监听 `http://localhost:8000`。所有 API 使用**统一单端点模式**：每个领域一个 URL，通过 `action` 字段或查询参数区分操作。

### 认证

所有认证操作通过 `POST /api/auth`，请求体中包含 `action` 字段：

| action | 说明 |
|--------|------|
| `register` | 发送邮箱验证码 |
| `verify` | 验证码校验 + 创建账号（返回 JWT） |
| `login` | 登录（返回 JWT） |
| `mine` | 获取当前用户信息 |
| `update-profile` | 更新用户资料（name, avatar, bio） |
| `change-password` | 修改密码 |
| `delete` | 注销账号（软删除） |

使用 JWT Bearer Token 认证。`register`、`verify`、`login` 和 `/api/chat` 无需认证。

### 聊天

所有聊天操作通过 `POST /api/chat`：

| action | 说明 |
|--------|------|
| （空） | 发送消息，SSE 流式响应 |
| `list` | 获取会话列表 |
| `messages` | 获取会话消息 |
| `delete` | 删除会话 |
| `rename` | 重命名会话 |
| `batch-delete` | 批量删除会话 |

### 社区数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/community/bind?action=...&platform=...` | POST | 平台绑定操作 |
| `/api/community/sync?platform=...` | POST | 触发已绑定平台的数据同步 |
| `/api/community/ws?token=...&platform=...` | WS | 绑定/同步进度实时推送 |
| `/api/community/data?platform=...` | GET | 获取已同步的数据 |

`bind` 的 `action` 可选值: `status`, `start`, `refresh`, `delete`。`platform` 可选值: `douban`, `weread`, `flomo`, `all`。

WebSocket 通过子协议传递 JWT token 进行认证，实时推送二维码、抓取进度、完成/失败状态。

## 架构

```
Go API Server (:8000)
  internal/
    config/          # config.yaml 加载（SMTP 预设、Redis、PostgreSQL、JWT、LLM）
    database/        # Ent ORM 客户端 + raw *sql.DB，自动建表 + 平台 seed
    email/           # SMTP 邮件发送（HTML 模板）
    middleware/      # JWT 认证中间件（路径白名单）+ CORS
    task/            # 通用 Manager[T] 协调（内存 map + channel 通知）
    ws/              # WebSocket handler（子协议认证、轮询任务状态）
  pkg/
    auth/            # 认证（handler/service/repo 三层，bcrypt + JWT + Redis）
    community/       # 平台绑定/同步编排、数据模型 + PostgreSQL CRUD
      douban/        # 豆瓣模型 + repo
      weread/        # 微信读书模型 + repo
      flomo/         # Flomo 模型 + repo + HTML/zip 导出解析
    scraper/         # Python Scraper HTTP 客户端（SSE 流解析）
    chat/            # AI 聊天（会话/消息持久化、LLM SSE 流式响应、自动标题生成）
  community/
    openai/          # OpenAI 兼容 HTTP 客户端（Chat + ChatStream，支持 reasoning_content）
  ent/               # Ent ORM 生成代码（schema 定义在 ent/schema/）

Python Scraper Service (:50051)
  scraper/
    server.py        # FastAPI 应用（POST /bind、POST /sync、POST /refresh、POST /unbind、GET /health）
    community/
      douban/        # 豆瓣（Playwright 登录 + requests 抓取）
      weread/        # 微信读书（Playwright 浏览器自动化）
      flomo/         # Flomo（Playwright 浏览器自动化 + HTML 导出解析）
```

### 数据库（PostgreSQL + Ent ORM）

Ent ORM，启动时自动建表（`Schema.Create`）。Schema 定义在 `ent/schema/`，修改后需运行 `go generate ./ent`。

| 表 | 说明 |
|----|------|
| `platforms` | 平台定义（douban=1, weread=2, flomo=3） |
| `users` | 用户账号（JWT 认证，软删除） |
| `community_meta` | 平台绑定状态、session state、profile JSON |
| `books` | 图书数据（豆瓣 + 微信读书） |
| `movies` | 影视数据（豆瓣） |
| `games` | 游戏数据（豆瓣） |
| `reviews` | 书评/影评（豆瓣） |
| `notes` | 日记（豆瓣） |
| `bookmarks` | 标注（微信读书） |
| `flomo_memos` | 日记（Flomo） |
| `sessions` | 聊天会话 |
| `messages` | 聊天消息 |

所有 `user_id` 外键引用 `users.id`，`CASCADE` 删除。模型有 `ToAPIDict()` 方法用于 API 响应，`ChangeHash()` 用于增量同步变更检测。

## 配置

`config.yaml`（已 gitignore）：

```yaml
smtp:
  provider: "qq"          # qq / outlook / 163 / 126 / yeah / custom
  username: ""
  password: ""

redis:
  host: "localhost"
  port: 6379
  db: 0
  password: ""

postgres:
  host: "localhost"
  port: 5432
  user: "lifeink"
  password: ""
  dbname: "lifeink"
  sslmode: "disable"

llm:
  url: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  model: "qwen-plus"
  api_key: ""

# jwt_secret: ""          # 留空则自动生成
# scraper_url: "http://127.0.0.1:50051"
```

## 旧版代码

旧版 Python FastAPI 后端代码（`src/`、`db/`、`tests/`、`__main__.py`）已在 Go 重写中移除。根目录的 `main.py`、`function/`、`json/` 为 Notion 同步遗留代码。
