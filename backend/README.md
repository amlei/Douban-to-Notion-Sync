# Backend

基于 FastAPI + Playwright 的社区数据抓取与 API 服务模块，独立管理依赖。

## 环境要求

- Python >= 3.12
- [uv](https://docs.astral.sh/uv/)
- Redis（用于邮箱验证码存储）

## 快速开始

```bash
cd backend

# 安装依赖
uv sync

# 安装浏览器（首次）
uv run python -m playwright install chromium

# 配置 SMTP + Redis（注册功能需要）
cp config-example.yaml config.yaml
# 编辑 config.yaml 填入 SMTP 凭据和 Redis 连接信息

# 启动 API 服务
uv run python src/api.py

# 或使用 CLI 抓取数据
uv run python __main__.py --type books --pages 3
```

## API 服务

启动后默认监听 `http://localhost:8000`，Swagger 文档在 `/docs`。

所有 API 使用 **统一单端点模式**：每个领域一个 URL，通过 `action` 字段或查询参数区分操作。

### 认证

所有认证操作通过 `POST /api/auth`，请求体中包含 `action` 字段：

| action | 方法 | 说明 |
|--------|------|------|
| `register` | POST | 发送邮箱验证码 |
| `verify` | POST | 验证码校验 + 创建账号（返回 JWT） |
| `login` | POST | 登录（返回 JWT） |
| `me` | GET | 获取当前用户信息 |
| `update` | PUT | 更新用户资料 |
| `change-password` | POST | 修改密码 |
| `delete` | POST | 注销账号（软删除） |

使用 JWT Bearer Token 认证。`register`、`verify`、`login` 和 `/api/chat` 无需认证。

### 社区数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | 流式聊天响应 |
| `/api/community/bind?action=...&platform=...` | POST | 平台绑定操作 |
| `/api/community/sync?platform=...` | POST | 触发已绑定平台的数据同步 |
| `/api/community/ws?token=...&platform=...` | WS | 绑定/同步进度实时推送 |
| `/api/community/data?platform=...` | GET | 获取已同步的数据 |

`action` 可选值: `status`, `start`, `refresh`, `delete`。`platform` 可选值: `douban`, `weread`, `flomo`, `all`。

## CLI 抓取

```bash
uv run python __main__.py --type <类型> [--pages <页数>]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--type` | 抓取类型：`profile` `books` `movies` `games` `reviews` `notes` `browser` | 必填 |
| `--pages` | 最大抓取页数 | 1 |

`browser` 类型会使用已保存的 session 打开一个交互式 Chromium 浏览器，方便调试或手动登录。

## 测试

```bash
uv run pytest tests/ -v -s                      # 运行全部测试
uv run pytest tests/test_weread_client.py -v -s  # 运行单个文件
```

测试使用真实 Chromium 浏览器，首次运行需要扫码登录。

## 项目结构

```
backend/
  pyproject.toml
  config-example.yaml               # SMTP + Redis 配置模板
  __main__.py                       # CLI 入口
  src/
    api.py                          # FastAPI 应用（路由、WebSocket）
    api/
      base.py                       # BindTask 数据类 + supported_platforms()
      douban.py                     # 豆瓣 AsyncBindManager
      weread.py                     # 微信读书 WereadBindManager
      flomo.py                      # Flomo FlomoBindManager
    core/
      auth/
        auth.py                     # JWT 创建/验证、密码哈希
        deps.py                     # get_current_user 依赖注入
        repository.py               # AuthRepo（用户 CRUD）
        routes.py                   # /api/auth 路由
      middleware.py                 # AuthMiddleware（全局 JWT 校验）
      utils/
        config.py                   # config.yaml 加载（SmtpConfig, RedisConfig）
        email.py                    # SMTP 邮件发送
        redis.py                    # Redis 客户端（验证码存储）
    community/
      douban/
        client.py                   # DoubanClient（上下文管理器）
        session.py                  # Session 管理（加载/保存 cookies）
        login.py                    # 二维码登录流程
        models/                     # Pydantic 数据模型
        scrapers/                   # 页面抓取器（base.py 为分页基类）
      weread/
        client.py                   # WereadClient（浏览器自动化）
        session.py                  # Session 管理（Playwright storage state）
        login.py                    # 登录流程
        models/                     # WeRead Pydantic 模型
        scrapers/                   # 书架、标注、个人资料抓取器
      flomo/
        client.py                   # FlomoClient（浏览器自动化）
        session.py                  # Session 管理（Playwright storage state）
        login.py                    # 登录流程
        models/                     # Flomo Pydantic 模型
        parser.py                   # HTML 导出解析
  db/
    engine.py                       # SQLAlchemy 异步引擎、会话工厂
    base.py                         # DeclarativeBase
    models.py                       # ORM 模型（User, CommunityMeta, BookRow, FlomoMemoRow 等）
    repository.py                   # 数据访问层（AuthRepo, CommunityMetaRepo, DataRepo）
  tests/
    test_login_integration.py       # 登录集成测试
    test_weread_client.py           # WeRead 客户端测试
    test_weread_login.py            # WeRead 登录测试
    test_weread_session.py          # WeRead Session 测试
```

## 编程使用

```python
from src.community.douban import DoubanClient

with DoubanClient() as client:
    client.ensure_ready()
    print(client.user_id)

    books = client.scrape_books(max_pages=2)
    for book in books:
        print(book.title, book.rating)
```
