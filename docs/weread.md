# WeRead Web API

微信读书新版 Web 端 API（`weread.qq.com/web/` 域下）。

> 旧版 `i.weread.qq.com` 接口已不可用（返回 401），详见 [weread-legacy.md](weread-legacy.md)。

## 认证方式

所有接口依赖浏览器 session cookies，必须在 `weread.qq.com` 域内发起请求（无法用 curl 直接调用）。

关键 cookies（`.weread.qq.com` 域）：

| Cookie | 说明 |
|--------|------|
| `wr_vid` | 用户 ID |
| `wr_skey` | 会话密钥 |
| `wr_rt` | 刷新 token |
| `wr_fp` | 指纹 |
| `wr_gid` | 访客 ID |
| `wr_ql` | 登录级别 |

## 完整流程：登录 + 获取数据

### 登录流程

点击"登录"后，iframe 内可能出现两种情况（取决于电脑是否登录了微信）：

```
情况 A：电脑未登录微信             情况 B：电脑已登录微信（自动检测）
+-------------------------+      +-------------------------+
|  直接显示二维码          |      |  自动显示"微信快捷登录"   |
|  用户扫码 -> 登录完成    |      |  点击"使用其他头像、     |
+-------------------------+      |   昵称或账号"            |
                                 |  -> 显示二维码           |
                                 |  用户扫码 -> 登录完成     |
                                 +-------------------------+
```

两种情况的共同处理逻辑：

1. 打开 `weread.qq.com` -> 点击"登录"
2. 等待 iframe 加载，检查 iframe 内是否出现"微信快捷登录"按钮
   - **有**：说明电脑已登录微信，自动检测到了。点击 iframe 内的"使用其他头像、昵称或账号"切换到二维码模式
   - **无**：等待 `img[alt="登录二维码"]` 出现
3. 截图二维码展示给用户
4. 用户扫码完成登录
5. 检测到 cookies 中出现 `wr_skey` + `wr_vid` 即为登录成功

> **注意**：不要点击"微信快捷登录"，那会直接用电脑微信的当前账号登录，无法控制使用哪个微信账号。应点击"使用其他头像、昵称或账号"切换为二维码扫码方式。

### 登录后的数据获取方式

登录后有两种数据来源：

**方式 A：API 接口** -- 从浏览器页面内 fetch 调用

```python
# 在已登录的浏览器上下文中，用 page.evaluate 调用 API
data = page.evaluate("""async () => {
    const r = await fetch('/web/book/info?bookId=25169058');
    return await r.json();
}""")
```

**方式 B：localStorage** -- 直接读取前端缓存的书架数据

```python
shelf_json = page.evaluate(
    "() => localStorage.getItem('shelf:rawBooks:' + document.cookie.match(/wr_vid=(\\d+)/)[1])"
)
```

### 完整代码示例

```python
"""WeRead: 登录 + 获取书架 + 获取书籍详情"""
import json
from playwright.sync_api import sync_playwright


def weread_login_and_fetch(state_path=".playwright/weread-state.json"):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, channel="msedge")
        context = browser.new_context()
        page = context.new_page()

        # ---- Step 1: 打开 weread 并触发登录 ----
        page.goto("https://weread.qq.com")
        page.wait_for_load_state("domcontentloaded")

        page.get_by_text("登录", exact=True).click()
        page.wait_for_timeout(2000)

        # ---- Step 2: 处理两种登录情况 ----
        iframe_loc = page.frame_locator("iframe").first

        # 电脑已登录微信时，会自动检测并显示"微信快捷登录"按钮
        # 此时需要点击"使用其他头像、昵称或账号"切换到二维码模式
        try:
            quick_btn = iframe_loc.get_by_role("button", name="微信快捷登录")
            quick_btn.wait_for(state="visible", timeout=3000)
            # 检测到快捷登录 -> 点击"使用其他方式"
            other_btn = iframe_loc.get_by_role("button", name="使用其他头像、昵称或账号")
            other_btn.click()
            page.wait_for_timeout(3000)
        except Exception:
            pass  # 没有快捷登录，说明直接显示二维码

        # ---- Step 3: 截图二维码展示给用户 ----
        qr_img = page.wait_for_selector('img[alt="登录二维码"]', timeout=10000)
        qr_bytes = qr_img.screenshot()
        # 将 qr_bytes 展示给用户（前端 base64 编码或保存为图片）

        # ---- Step 4: 轮询等待登录完成（检测 wr_skey + wr_vid cookies） ----
        vid = None
        for _ in range(60):
            page.wait_for_timeout(2000)
            cookies = context.cookies()
            wr_skey = next((c["value"] for c in cookies if c["name"] == "wr_skey"), None)
            vid = next((c["value"] for c in cookies if c["name"] == "wr_vid"), None)
            if wr_skey and vid:
                break

        if not vid:
            raise RuntimeError("Login timeout")

        # ---- Step 5: 保存浏览器状态 ----
        state = context.storage_state(path=state_path)

        # ---- Step 6: 获取数据 ----
        page.goto("https://weread.qq.com/web/shelf")
        page.wait_for_load_state("networkidle")

        # 方式 A: 读取 localStorage 书架数据
        shelf_raw = page.evaluate(f"() => localStorage.getItem('shelf:rawBooks:{vid}')")
        shelf_books = json.loads(shelf_raw) if shelf_raw else []

        # 方式 B: 调用 API 获取书籍详情
        book_info = page.evaluate("""async (bookId) => {
            const r = await fetch('/web/book/info?bookId=' + bookId);
            return await r.json();
        }""", shelf_books[0]["bookId"] if shelf_books else "")

        # 方式 C: 获取章节列表
        chapters = page.evaluate("""async (bookId) => {
            const r = await fetch('/web/book/chapterInfos', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({bookIds: [bookId], synckeys: [0], teenmode: 0})
            });
            return await r.json();
        }""", shelf_books[0]["bookId"] if shelf_books else "")

        # 方式 D: 获取笔记
        bookmarks = page.evaluate("""async (bookId) => {
            const r = await fetch('/web/book/bookmarklist?bookId=' + bookId + '&synckey=0');
            return await r.json();
        }""", shelf_books[0]["bookId"] if shelf_books else "")

        browser.close()

        return {
            "vid": vid,
            "shelf": shelf_books,
            "book_info": book_info,
            "chapters": chapters,
            "bookmarks": bookmarks,
        }
```

### 后续复用（已有 state 文件）

登录成功后 state 保存在 `.playwright/weread-state.json`，后续可直接加载而无需重新登录：

```python
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, channel="msedge")
    context = browser.new_context(storage_state=".playwright/weread-state.json")
    page = context.new_page()

    page.goto("https://weread.qq.com/web/shelf")
    page.wait_for_load_state("networkidle")

    # 直接读取数据
    data = page.evaluate("""async () => {
        const r = await fetch('/web/book/info?bookId=25169058');
        return await r.json();
    }""")

    browser.close()
```

注意：state 中的 cookies 会过期（`wr_skey` 有效期较短），过期后需重新走登录流程。

---

## API 接口

### 获取用户信息

```
GET /web/user?userVid={vid}
```

```json
{
  "userVid": 422916857,
  "name": "ComosGalaxy",
  "gender": 1,
  "avatar": "https://thirdwx.qlogo.cn/mmopen/vi_32/.../132",
  "isV": 0,
  "roleTags": [],
  "followPromote": "",
  "isDeepV": false,
  "deepVTitle": "",
  "isHide": 1,
  "signature": "",
  "location": "",
  "publish": 0
}
```

### 获取书籍详情

```
GET /web/book/info?bookId={bookId}
```

返回完整的书籍信息：

```json
{
  "bookId": "25169058",
  "title": "作家榜名著：月亮与六便士",
  "author": "[英]毛姆",
  "translator": "徐淳刚",
  "cover": "https://cdn.weread.qq.com/weread/cover/58/yuewen_25169058/t6_yuewen_251690581750754477.jpg",
  "version": 1041727091,
  "format": "epub",
  "type": 0,
  "price": 9.99,
  "originalPrice": 0,
  "soldout": 0,
  "bookStatus": 1,
  "payingStatus": 1,
  "payType": 4097,
  "intro": "书籍简介...",
  "centPrice": 999,
  "category": "文学-外国文学",
  "categories": [
    {
      "categoryId": 300000,
      "subCategoryId": 300013,
      "categoryType": 0,
      "title": "文学-外国文学"
    }
  ],
  "finished": 1,
  "maxFreeChapter": 11,
  "maxFreeInfo": {
    "maxFreeChapterIdx": 11,
    "maxFreeChapterUid": 74,
    "maxFreeChapterRatio": 60
  },
  "free": 0,
  "ispub": 1,
  "publishTime": "2018-07-01 00:00:00",
  "lastChapterIdx": 64,
  "chapterSize": 64,
  "totalWords": 134777,
  "isbn": "9787508690650",
  "publisher": "中信出版社",
  "language": "zh-wr",
  "newRating": 851,
  "newRatingCount": 6485,
  "newRatingDetail": {
    "good": 5533,
    "fair": 739,
    "poor": 213,
    "recent": 115,
    "title": "好评如潮"
  },
  "ratingCount": 6902,
  "ratingDetail": {
    "one": 245,
    "two": 2,
    "three": 756,
    "four": 32,
    "five": 5867,
    "recent": 118
  },
  "star": 85,
  "copyrightInfo": {
    "id": 5497215,
    "name": "大星文化",
    "userVid": 307561086,
    "role": 2,
    "avatar": "https://wx.qlogo.cn/mmhead/.../0",
    "cpType": 0
  },
  "authorSeg": [
    { "words": "[英]", "highlight": 0 },
    { "words": "毛姆", "highlight": 1, "authorId": "108614" }
  ],
  "translatorSeg": [
    { "words": "徐淳刚", "highlight": 1, "authorId": "403029" }
  ],
  "coverBoxInfo": {
    "blurhash": "K53uZ*-goN%7$^s:IYRPxZ",
    "dominate_color": { "hex": "#02002c", "hsv": [242.49, 99.75, 17.28] },
    "custom_cover": "https://weread-1258476243.file.myqcloud.com/bookalphacover/58/25169058/s_25169058.jpg",
    "custom_rec_cover": "https://weread-1258476243.file.myqcloud.com/bookreccover/58/25169058/s_25169058.jpg",
    "colorsPure": ["#738fe7", "#8aa9ff"]
  },
  "finishReading": 0,
  "paid": 0,
  "updateTime": 1760179208,
  "onTime": 1556442928,
  "askAIBook": 1
}
```

主要字段说明：

| 字段 | 说明 |
|------|------|
| `bookId` | 书籍唯一 ID |
| `title` | 书名 |
| `author` / `authorSeg` | 作者（authorSeg 含高亮分段和 authorId） |
| `translator` / `translatorSeg` | 译者 |
| `cover` | 封面图 URL |
| `intro` | 书籍简介 |
| `isbn` | ISBN 号 |
| `publisher` | 出版社 |
| `publishTime` | 出版日期 |
| `totalWords` | 总字数 |
| `price` / `centPrice` | 价格（元/分） |
| `newRating` | 新评分（满分 1000） |
| `newRatingDetail.title` | 评级标签（神作/好评如潮/脍炙人口等） |
| `newRatingDetail.good/fair/poor` | 好/中/差评数 |
| `categories` | 分类列表 |
| `finished` | 是否完结（1=完结） |
| `finishReading` | 当前用户是否读完（1=读完） |
| `chapterSize` / `lastChapterIdx` | 章节数/最后一章索引 |
| `maxFreeChapter` | 免费试读章节范围 |
| `copyrightInfo` | 版权方信息 |

### 获取书籍章节列表

```
POST /web/book/chapterInfos
Content-Type: application/json

{
  "bookIds": ["25169058"],
  "synckeys": [0],
  "teenmode": 0
}
```

```json
{
  "data": [
    {
      "bookId": "25169058",
      "soldOut": 0,
      "clearAll": 0,
      "chapterUpdateTime": 1760179208,
      "updated": [
        {
          "chapterUid": 1,
          "chapterIdx": 1,
          "updateTime": 1715275806,
          "readAhead": 0,
          "tar": "https://res.weread.qq.com/wrco/tar_CB_25169058_1",
          "title": "封面",
          "wordCount": 1,
          "price": 0,
          "paid": 0,
          "isMPChapter": 0,
          "level": 1,
          "files": ["Text/cover.xhtml"]
        }
      ],
      "removed": [],
      "synckey": 1041727091,
      "book": {
        "bookId": "25169058",
        "version": 1041727091,
        "format": "epub",
        "cover": "https://...",
        "title": "...",
        "author": "...",
        "price": 9.99,
        "type": 0
      }
    }
  ]
}
```

支持批量查询：`bookIds` 和 `synckeys` 可传多个 ID。

章节主要字段：

| 字段 | 说明 |
|------|------|
| `chapterUid` | 章节唯一 ID |
| `chapterIdx` | 章节序号 |
| `title` | 章节标题 |
| `wordCount` | 字数 |
| `price` | 价格（-1=付费，0=免费） |
| `paid` | 是否已付费 |
| `level` | 层级（1=章，2=节） |
| `tar` | 内容包 URL（为空表示未下载） |

### 获取书籍笔记/标注

```
GET /web/book/bookmarklist?bookId={bookId}&synckey=0
```

无笔记时返回 `{}`。有笔记时返回格式：

```json
{
  "synckey": 1776482946,
  "updated": [
    {
      "bookId": "25169058",
      "style": 1,
      "bookVersion": 1041727091,
      "range": "12490-12554",
      "markText": "标注文本内容...",
      "colorStyle": 0,
      "type": 1,
      "chapterUid": 26,
      "createTime": 1776482946,
      "bookmarkId": "25169058_26_12490-12554",
      "chapterName": "章节名称",
      "chapterIdx": 11
    }
  ],
  "book": {
    "bookId": "25169058",
    "version": 1041727091,
    "format": "epub",
    "cover": "https://...",
    "title": "...",
    "author": "..."
  }
}
```

笔记字段：

| 字段 | 说明 |
|------|------|
| `markText` | 标注文本 |
| `chapterName` | 所属章节 |
| `chapterIdx` | 章节序号 |
| `range` | 在章节中的字符范围 |
| `style` | 标注样式（0=下划线，1=背景色等） |
| `colorStyle` | 颜色 |
| `type` | 类型（0=标注，1=想法等） |
| `createTime` | 创建时间戳 |

---

## 书架数据（localStorage）

书架数据存在浏览器 localStorage 中，不通过 API 获取。

| Key | 说明 |
|-----|------|
| `shelf:rawBooks:{vid}` | 书架书籍详情（JSON 数组） |
| `shelf:shelfIndexes:{vid}` | 书架排序索引 |
| `{vid}:book:lastChapters` | 每本书最后阅读章节 |

`shelf:rawBooks:{vid}` 每本书的结构与 `/web/book/info` 基本一致，额外包含：

| 字段 | 说明 |
|------|------|
| `finishReading` | 是否读完 |
| `paid` | 是否已购买 |
| `readUpdateTime` | 最近阅读时间 |

---

## 不可用的旧接口

以下 `i.weread.qq.com` 接口均返回 `{"errcode": -2012, "errmsg": "登录超时"}`，已不可用：

- `/user/profile` - 用户资料
- `/mine/readbook` - 阅读书籍列表
- `/user/notebooks` - 笔记本列表
- `/readdata/detail` - 阅读数据
- `/friend/ranking` - 好友排行
- `/book/chapterInfos` - 章节信息

这些接口的参数和返回格式见 [weread-legacy.md](weread-legacy.md)。

---

## Playwright 请求方式

因为认证依赖浏览器 cookies，API 必须在浏览器上下文中调用：

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, channel="msedge")
    context = browser.new_context(storage_state=".playwright/weread-state.json")
    page = context.new_page()

    # 先导航到 weread 激活 cookies
    page.goto("https://weread.qq.com/web/shelf")
    page.wait_for_load_state("networkidle")

    # 方式1: 从页面内 fetch（推荐，自动带 cookies）
    data = page.evaluate("""async () => {
        const r = await fetch('/web/book/info?bookId=25169058');
        return await r.json();
    }""")

    # 方式2: 用 context.request 发请求
    resp = context.request.get("https://weread.qq.com/web/book/info?bookId=25169058")

    # 方式3: 读取 localStorage
    shelf = page.evaluate("() => localStorage.getItem('shelf:rawBooks:422916857')")
```
