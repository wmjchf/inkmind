# InkMind 后端

1. 本地安装 MySQL，`cp .env.example .env`，填写 `MYSQL_*`、`JWT_SECRET`；本地联调可设 `WECHAT_DEV_MOCK=1`（任意 `code` 可登录）。
2. **初始化库表（二选一）**
   - 推荐：在 `backend/` 下执行 **`npm run db:init`**（会读取同目录的 **`schema.sql`** 并执行）。
   - 或手动：`mysql -u root -p < schema.sql`（在 `backend/` 下）
   - 可选：开发环境在 `.env` 中加 **`AUTO_INIT_DB=1`**，则 `npm run dev` 启动前会自动跑一遍 schema（仅 `NODE_ENV=development` 时生效）。
   - 若 SQL 不在默认位置，可设置 **`SCHEMA_PATH`** 为绝对路径。
3. `npm install` → `npm run dev`。
4. 健康检查：`GET http://127.0.0.1:3000/health`。

**阿里云 OCR（无 Node SDK）**：配置 `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET` 后，`POST /api/v1/ocr/recognize`（`Authorization: Bearer …`，`multipart` 字段 `image`）走 OpenAPI 自签名调用 **`RecognizeAdvanced`（全文识别高精版）**；需在阿里云开通通用文字识别并购买/使用全文识别高精版额度（实现见 `src/services/aliyunOcr.ts`）。

**AI 打标签**：`POST /api/v1/entries/:id/tags/ai` 等；body 可选 `strategy`：`merge`（默认）、`append_if_empty`、`replace_ai_only`。推荐配置 **`DASHSCOPE_API_KEY`**；模型由 **`AI_MODEL`**（或兼容旧名 **`AI_TAG_MODEL`**）指定，未设时默认 **`qwen3.6-plus`** / **`gpt-4o-mini`**，与解读相同。也可使用 **`OPENAI_API_KEY`** + `AI_CHAT_BASE_URL`。无 Key 时用占位词。逻辑见 `src/services/aiTagSuggest.ts`、`applyAiTags`。

**AI 解读**：`POST /api/v1/entries/:id/interpret` 与打标签共用同一套 Key、Base URL 与模型。无 Key 时写入内置静态文案。见 `src/services/aiInterpret.ts`、`runInterpretation`。

正式环境请配置 `WECHAT_APPID`、`WECHAT_APPSECRET` 并关闭 `WECHAT_DEV_MOCK`。
