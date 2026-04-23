# InkMind 后端技术实现方案（MVP）

与 PRD 对齐：**Node.js + Express + MySQL**。OCR / 大模型供应商可插拔（接口层抽象，实现待定）。

可执行的建表脚本见 **`../backend/schema.sql`**（与下文字段一致，可直接在 MySQL 8 中初始化，或由 `npm run db:init` 执行）。

---

## 1. 总体架构

| 层级 | 说明 |
|------|------|
| 接入层 | HTTPS、限流、CORS（若含 H5）、请求体大小限制 |
| 认证 | 微信 `code` 换会话 + 自建 JWT（或 Session，推荐 JWT 便于小程序无状态调用） |
| 业务层 | 用户、收藏句、标签、AI 解读、配额、分享元数据 |
| 任务层 | （可选）异步队列：OCR、打标签、生成解读，避免阻塞 HTTP |
| 数据层 | MySQL 8.x，核心表 InnoDB，UTF8MB4 |

**部署建议**：单实例 + MySQL 云库即可承载 MVP；静态资源（分享图）可先落对象存储或本地磁盘，后续再接 CDN。

---

## 2. 登录与用户体系（小程序）

### 2.1 推荐方案：微信登录 + 自建用户表

流程：

1. 小程序端 `Taro.login()` 取得 **临时 `code`**（有效期短，仅服务端可用）。
2. 客户端将 `code` 发给后端 `POST /auth/wechat/login`。
3. 服务端调用微信 `jscode2session`，用 `appid + secret + code` 换取 **`openid`**，同一用户在同一小程序下唯一；若开通开放平台可再拿 **`unionid`**（多端统一时有用）。
4. 服务端根据 `openid` **查找或创建** `users` 记录，签发 **访问令牌**（建议 JWT，`sub` = 内部 `user_id`，带 `exp`）。
5. 后续请求头：`Authorization: Bearer <access_token>`。

**安全要点**：

- `secret` 仅放服务端环境变量，禁止进前端包。
- `session_key` 不要下发给前端；敏感解密（若用手机号组件等）在服务端完成。
- JWT 使用短过期（如 7 天）+ 刷新令牌策略（MVP 可先只做 access token，配合重新 `wx.login` 静默续期）。
- 对 `user_id` 做所有资源隔离，禁止仅靠客户端传 openid。

### 2.2 可选增强

- **手机号绑定**：微信「手机号快速验证」组件，服务端解密后写入 `users.phone`（注意合规与隐私政策）。
- **账号合并**：有 `unionid` 时以 `unionid` 为主键关联；仅 `openid` 时按小程序维度一个用户一条。

### 2.3 会员与配额（对齐 PRD 免费 / Pro）

MVP 可在 `users` 上增加 `plan`（`free` / `pro`）与计数字段，或单独 `subscriptions` 表（便于后续接支付回调）。**免费版 100 条收藏**在创建收藏时校验 `COUNT(entries)` 或冗余计数器。

---

## 3. 数据库表结构（MySQL）

字符集：`utf8mb4`，排序：`utf8mb4_unicode_ci`。主键统一 `BIGINT` 自增或 `CHAR(36)` UUID，下文用自增示例。

### 3.1 `users` — 用户

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AI | 内部用户 ID |
| wechat_openid | VARCHAR(64) UNIQUE NOT NULL | 小程序 openid |
| wechat_unionid | VARCHAR(64) NULL UNIQUE | 开放平台 unionid，可空 |
| nickname | VARCHAR(64) NULL | 昵称 |
| avatar_url | VARCHAR(512) NULL | 头像 URL |
| plan | ENUM('free','pro') NOT NULL DEFAULT 'free' | 会员档位 |
| entry_count | INT NOT NULL DEFAULT 0 | 收藏条数冗余，便于限额与列表性能 |
| ocr_count_month | INT NOT NULL DEFAULT 0 | 本月 OCR 次数（可按账期重置） |
| created_at / updated_at | DATETIME(3) | 时间戳 |

索引：`(wechat_openid)`、`(wechat_unionid)`（可部分唯一）。

### 3.2 `entries` — 收藏句（核心内容）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AI | |
| user_id | BIGINT NOT NULL FK → users.id | 归属用户 |
| content | TEXT NOT NULL | 句子正文 |
| source_type | ENUM('manual','ocr') NOT NULL | 录入来源 |
| source_image_url | VARCHAR(512) NULL | OCR 原图（若有），注意隐私与存储成本 |
| book_title | VARCHAR(255) NULL | 可选书名 |
| note | VARCHAR(500) NULL | 用户备注 |
| visibility | ENUM('private','public','unlisted')，默认 `private` | 二期广场用；MVP 可不暴露给前端，一律当私有 |
| published_at | DATETIME(3) NULL | 首次/再次「公开发布」时间，广场排序用 |
| like_count / comment_count | INT UNSIGNED，默认 0 | 广场列表展示用冗余计数；MVP 保持 0 即可 |
| is_deleted | TINYINT(1) NOT NULL DEFAULT 0 | 软删 |
| created_at / updated_at | DATETIME(3) | |

索引：`(user_id, created_at DESC)`、`(user_id, is_deleted)`、`(visibility, is_deleted, published_at DESC)`（公开信息流）。全文检索 MVP 可用 `LIKE` + 前缀；数据量大再上 **MySQL FULLTEXT** 或 **Elasticsearch**。

### 3.3 `tags` + `entry_tags` — 标签（AI / 用户）

**方案 A（推荐）**：规范化多对多，便于搜索「某标签下全部句子」。

`tags`：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AI | |
| user_id | BIGINT NOT NULL FK | 用户私有标签空间；系统预置标签也可 `user_id` 固定或单独 `is_system` |
| name | VARCHAR(32) NOT NULL | 标签名 |
| slug | VARCHAR(32) NULL | 规范化键，可选 |
| created_by | ENUM('user','ai','system') NOT NULL | 来源 |
| UNIQUE(user_id, name) | | 同用户不重复 |

`entry_tags`：

| entry_id | BIGINT FK |
| tag_id | BIGINT FK |
| PRIMARY KEY (entry_id, tag_id) | |

### 3.4 `ai_interpretations` — AI 单句解读（可多条历史）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AI | |
| entry_id | BIGINT NOT NULL FK | |
| user_id | BIGINT NOT NULL FK | 冗余，便于按用户清理 |
| summary | TEXT NOT NULL | 句子核心含义 |
| resonance | TEXT NOT NULL | 为何易共鸣 |
| reflection_question | VARCHAR(500) NOT NULL | 反思问题 |
| provider | VARCHAR(32) NULL | 如 openai / qwen |
| model | VARCHAR(64) NULL | 模型名 |
| raw_response | JSON NULL | 可选，排错 |
| created_at | DATETIME(3) | |

业务规则：列表页可只展示 **最新一条**（`MAX(id)` 或 `is_current` 标记二选一）；MVP 可用「每条 entry 只保留最新解读」简化。

### 3.5 `share_cards`（可选）— 分享卡片元数据

若分享图为前端 canvas 生成，此表可简化为只记分享次数；若服务端拼图则存 `image_url`。

| id | BIGINT PK |
| entry_id | BIGINT FK |
| user_id | BIGINT FK |
| template | VARCHAR(32) | 模板 ID |
| image_url | VARCHAR(512) NULL | |
| created_at | DATETIME(3) | |

### 3.6 `refresh_tokens`（若采用双令牌）

| id | BIGINT PK |
| user_id | BIGINT FK |
| token_hash | CHAR(64) NOT NULL | 只存哈希 |
| expires_at | DATETIME(3) | |
| revoked_at | DATETIME(3) NULL | |

---

## 4. 核心 API 设计（REST 示例）

前缀：`/api/v1`。统一 JSON，`401` 未登录，`403` 无权限，`429` 配额用尽。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/wechat/login | body: `{ code }` → `{ access_token, expires_in, user }` |
| POST | /auth/refresh | body: `{ refresh_token }`（若启用） |
| GET | /me | 当前用户信息与配额摘要 |
| GET | /entries | 分页、标签筛选、`q` 搜索 |
| POST | /entries | 新建；校验 free 100 条上限 |
| GET | /entries/:id | 详情含最新解读、标签 |
| PATCH | /entries/:id | 编辑正文、备注、书名 |
| DELETE | /entries/:id | 软删 |
| POST | /entries/:id/ocr | 上传图片或传对象存储 key，异步/同步 OCR，回写 `content` + `source_type=ocr` |
| POST | /entries/:id/tags | 增删标签（AI 回调也可写） |
| POST | /entries/:id/interpret | 触发 AI 解读（可幂等：同 entry 覆盖或版本表） |
| GET | /entries/daily-random | 今日随机一条（可按用户 seed 或服务端记录「今日已推」） |
| GET | /stats/summary | 个人中心：总数、本周新增等 |

**OCR / AI**：建议独立 `services/ocrProvider.js`、`services/llmProvider.js`，从环境变量读 API Key，单元测试可 mock。

---

## 5. 非功能与运维

- **日志**：请求 ID、user_id、关键业务事件（登录、创建收藏、解读失败原因脱敏）。
- **限流**：按 IP + user_id 限制 `/interpret`、`/ocr`。
- **备份**：MySQL 自动备份；若存用户图片，生命周期策略与合规说明写进隐私政策。

---

## 6. 与 PRD 排期对应

- **第 1 周**：`/auth/wechat/login`、`/entries` CRUD、`/me`、首页列表搜索所需字段与索引。
- **第 2 周**：OCR 接口、标签写入、解读接口、分享相关统计或静态资源；部署与监控。

本文档随 OCR/AI 供应商确定后，在「接口入参/出参」与「异步队列」两节可再补一版细化。

---

## 7. 未来扩展：社区广场（评论 / 点赞等）

当前 MVP 以 **`entries` + `user_id` 私有隔离** 为主，与「广场」并不冲突：广场本质是**同一条 `entry` 在「公开」语义下的可读范围扩大**，社交行为挂在**稳定的业务 ID**上即可。

**库表层面**：`backend/schema.sql` 里已在 `entries` 上预留 **`visibility` / `published_at` / `like_count` / `comment_count`** 及公开流索引；MVP 业务代码可全部忽略（默认私有、计数为 0），不必改接口形态。

**二期再建表/加字段即可**：

- **过审（可选）**：如 `moderation_status`，与 `visibility=public` 组合使用。
- **评论**：新表 `entry_comments`（`entry_id`, `user_id`, `body`, `parent_id` 可选做楼中楼, `is_deleted`），索引 `(entry_id, created_at)`。
- **点赞**：新表 `entry_likes`（`entry_id`, `user_id`, `UNIQUE(entry_id, user_id)`）防重复点赞；计数用触发器/定时任务或事务内更新 `entries.like_count`。
- **信息流与性能**：广场列表可按 `published_at` 分页；热度排序可另加 `hot_score` 或宽表；量大时再引入缓存或 ES。
- **产品与合规**：公开前需明确用户授权、版权（摘录句子）、审核与举报；与 MVP 隐私模型区分清楚即可。

按上方式扩展时，**不需要推翻现有表**，多为加字段 + 新表 + 新只读接口（广场 Feed、评论 CR、点赞 toggle）。
