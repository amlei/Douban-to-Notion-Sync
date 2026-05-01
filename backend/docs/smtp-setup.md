# SMTP 邮箱配置指南

LifeInk AI 使用邮箱发送注册验证码。在 `backend/config.yaml` 中配置 SMTP 参数。

## 快速配置

```yaml
smtp:
  provider: "qq"        # qq / outlook / 163 / 126 / yeah / custom
  username: "your@email.com"
  password: "your-auth-code"
```

`provider` 为预设邮箱时，host/port/SSL 自动填充，只需填 `username` 和 `password`。

各邮箱的 `provider` 值：

| 邮箱 | provider | 协议 |
|------|----------|------|
| QQ 邮箱 | `qq` | SSL 465 |
| Outlook | `outlook` | STARTTLS 587 |
| 163 邮箱 | `163` | SSL 465 |
| 126 邮箱 | `126` | SSL 465 |
| yeah 邮箱 | `yeah` | SSL 465 |
| 自定义 | `custom` | 需手动填写 host/port |

使用自定义域名时，手动覆盖 host/port：

```yaml
smtp:
  provider: "custom"
  host: "smtp.example.com"
  port: 465
  use_ssl: true
  username: "your@email.com"
  password: "your-password"
```

## 获取授权码

`password` 不是邮箱登录密码，而是各邮箱提供的 **SMTP 授权码**。获取方式如下：

### QQ 邮箱

1. 登录 QQ 邮箱网页版
2. 进入 **设置 > 账户**
3. 下拉找到 **POP3/SMTP 服务** 并开启
4. 开启后页面会显示一个 16 位授权码，复制保存
5. 将授权码填入 `password` 字段

### Outlook

1. 前往 Outlook.com 的 **设置 > 邮件 > 同步电子邮件 > POP 和 IMAP**
2. 确保 **允许设备和应用使用 POP** 的选项是勾选状态
3. 密码通常可以直接使用 Outlook 登录密码

### 网易邮箱（163 / 126 / yeah）

1. 登录邮箱网页版
2. 进入 **设置 > POP3/SMTP/IMAP**
3. 开启 POP3/SMTP 服务
4. 打开 **客户端授权密码**，生成授权码
5. 将授权码填入 `password` 字段

## 完整配置示例

```yaml
jwt:
  secret: "your-jwt-secret"
  expire_minutes: 1440
  algorithm: "HS256"

smtp:
  provider: "qq"
  username: "123456@qq.com"
  password: "abcdefghijklmnop"
```
