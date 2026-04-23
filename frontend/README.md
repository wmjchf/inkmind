# InkMind 小程序（Taro）

1. 安装依赖：`npm install`
2. 确认 `src/config.ts` 中 `API_BASE` 指向你的后端（本地默认 `http://127.0.0.1:3000/api/v1`）。
3. 微信开发者工具导入本目录，**关闭「校验合法域名」**以便访问本地 HTTP 后端。
4. 开发编译：`npm run dev:weapp`，将 `dist/` 作为小程序根目录（与 `project.config.json` 一致）。
5. 后端需开启 `WECHAT_DEV_MOCK=1` 或配置真实小程序 `appid`，否则 `wx.login` 换票会失败。

**交互**：底部 Tab 中间「＋」调起相机；首页为搜索 + 标签筛选；**手动输入**入口在「我的」页顶部卡片。
