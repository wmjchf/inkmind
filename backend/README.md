# InkMind 后端

1. 本地安装 MySQL，`cp .env.example .env`，填写 `MYSQL_*`、`JWT_SECRET`；本地联调可设 `WECHAT_DEV_MOCK=1`（任意 `code` 可登录）。
2. **初始化库表（二选一）**
   - 推荐：在 `backend/` 下执行 **`npm run db:init`**（会读取同目录的 **`schema.sql`** 并执行）。
   - 或手动：`mysql -u root -p < schema.sql`（在 `backend/` 下）
   - 可选：开发环境在 `.env` 中加 **`AUTO_INIT_DB=1`**，则 `npm run dev` 启动前会自动跑一遍 schema（仅 `NODE_ENV=development` 时生效）。
   - 若 SQL 不在默认位置，可设置 **`SCHEMA_PATH`** 为绝对路径。
3. `npm install` → `npm run dev`。
4. 健康检查：`GET http://127.0.0.1:3000/health`。

正式环境请配置 `WECHAT_APPID`、`WECHAT_APPSECRET` 并关闭 `WECHAT_DEV_MOCK`。
