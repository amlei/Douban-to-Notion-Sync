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

# 配置 SMTP / Redis / PostgreSQL
cp config-example.yaml config.yaml

# 启动（默认监听 :8000）
go run main.go
```

### Python Scraper 微服务

```bash
cd backend/scraper

# 安装依赖
pip install -r requirements.txt

# 安装浏览器（首次）
python -m playwright install chromium

# 启动（默认监听 :50051，仅供 Go 后端内部调用）
uvicorn server:app --port 50051
```

### 前端

```bash
cd frontend
bun install
bun run dev
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

### 社区数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/community/bind?action=...&platform=...` | POST | 平台绑定操作 |
| `/api/community/sync?platform=...` | POST | 触发已绑定平台的数据同步 |
| `/api/community/ws?token=...&platform=...` | WS | 绑定/同步进度实时推送 |
| `/api/community/data?platform=...` | GET | 获取已同步的数据 |
| `/api/chat` | POST | 流式聊天响应（mock） |

`bind` 的 `action` 可选值: `status`, `start`, `refresh`, `delete`。`platform` 可选值: `douban`, `weread`, `flomo`, `all`。

WebSocket 通过子协议传递 JWT token 进行认证，实时推送二维码、抓取进度、完成/失败状态。

## 架构

```
Go API Server (:8000)
  internal/
    config/          # config.yaml 加载（SMTP 预设、Redis、PostgreSQL、JWT）
    database/        # Bun ORM + pgdriver PostgreSQL 初始化 + 平台 seed
    email/           # SMTP 邮件发送（HTML 模板）
    middleware/      # JWT 认证中间件（路径白名单）+ CORS
    redis/           # Redis 操作（验证码 10min TTL、JWT 24h TTL）
    task/            # BindTask 协调（内存 map + channel 通知）
    ws/              # WebSocket handler（子协议认证、轮询任务状态）
  pkg/
    auth/            # 认证（handler/service/repo 三层，bcrypt + JWT + Redis）
    community/       # 平台绑定/同步编排、数据模型 + PostgreSQL CRUD
      douban/        # 豆瓣模型 + repo
      weread/        # 微信读书模型 + repo
      flomo/         # Flomo 模型 + repo + HTML/zip 导出解析
    scraper/         # Python Scraper HTTP 客户端（SSE 流解析）
    chat/            # Mock 聊天流式响应

Python Scraper Service (:50051)
  scraper/
    server.py        # FastAPI 应用（POST /bind、POST /sync、POST /refresh、POST /unbind、GET /health）
    community/
      douban/        # 豆瓣（Playwright 登录 + requests 抓取）
      weread/        # 微信读书（Playwright 浏览器自动化）
      flomo/         # Flomo（Playwright 浏览器自动化 + HTML 导出解析）
```

### 数据库（PostgreSQL）

Bun ORM，无自动建表，schema 需预先创建。

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

# jwt_secret: ""          # 留空则自动生成
# scraper_url: "http://127.0.0.1:50051"
```

## 旧版代码

旧版 Python FastAPI 后端代码（`src/`、`db/`、`tests/`、`__main__.py`）已在 Go 重写中移除。
