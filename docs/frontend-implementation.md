# InkMind 前端技术实现方案（MVP）

与 PRD 对齐：**Taro** 微信小程序为主，目录与规范便于后续扩展 **React Native App**（可复用业务逻辑层）。

---

## 1. 技术栈与工程结构

| 项 | 选型 |
|----|------|
| 框架 | Taro 3.x + React |
| 语言 | TypeScript |
| 样式 | Sass / Less + 设计 Token（颜色、字号、间距） |
| 请求 | 封装 `fetch` 或 `@tarojs/taro` request 拦截器 |
| 状态 | MVP 可用 **React Context + useReducer**；条目增多后迁 **Zustand** |
| 路由 | Taro 约定式路由：`src/pages/*` |

建议目录示例：

```text
src/
  app.config.ts          // 页面路由、tabBar
  app.tsx / app.scss
  services/
    api.ts               // baseURL、token 注入、错误码
    auth.ts
    entries.ts
  store/
    user.ts              // 登录态、会员信息
    entries.ts           // 可选：列表缓存
  pages/
    index/               // 首页：列表、搜索、入口
    add/                 // 添加：手动输入 / 选图 OCR
    entry-detail/        // 详情：编辑、删除、解读、分享
    profile/             // 个人中心：统计、会员入口
  components/
  utils/
    constants.ts
```

---

## 2. 登录体系（小程序）

### 2.1 与后端的配合

1. 进入应用或「需登录操作」前调用 `Taro.login()`，取得 `code`。
2. `POST /api/v1/auth/wechat/login`，body：`{ code }`。
3. 将返回的 `access_token` 存入 **`Taro.setStorageSync`**（注意：小程序存储非加密，敏感信息仍避免存明文 refresh 的长期方案需评估）。
4. 封装请求：在 header 中附加 `Authorization: Bearer <token>`。
5. **401**：清除本地 token，跳转登录页或静默重新 `Taro.login` 再换 token（视产品策略）。

### 2.2 用户信息展示

`GET /me` 返回昵称、头像、`plan`、收藏数上限提示等。头像昵称可用 **「头像昵称填写能力」** 或仅展示微信资料（需后端存库时在首次登录写入）。

### 2.3 权限与体验

- 免费版 **100 条**：在「添加」页根据 `me.entry_count` 与上限禁用提交并提示升级 Pro（Pro 支付为后续迭代可先占位）。
- 未登录：首页可浏览占位文案或仅展示登录引导（按产品选择）。

---

## 3. 页面与数据流（对齐 PRD 页面结构）

### 3.1 首页（内容列表 / 搜索 / 添加）

- **列表**：`GET /entries?page=&pageSize=&tagId=&q=`，下拉刷新、上拉分页。
- **搜索**：输入防抖后带 `q` 请求；空态与加载态分离。
- **标签筛选**：横向滚动标签 chips，选中切换 `tagId`。
- **添加入口**：FAB 或导航至添加页。

### 3.2 添加页（手动 / OCR）

- **手动输入**：多行文本 + 可选书名、备注 → `POST /entries`。
- **OCR**：`Taro.chooseMedia` 选图 → 可先 **直传对象存储**（若后端提供预签名 URL）或 **multipart 上传** 至 `POST /entries/:id/ocr` / 或「先建空 entry 再填内容」的编排与后端约定一致即可。
- 提交成功后 `Taro.navigateBack` 或进详情触发 **AI 标签 + 解读**（可自动 `POST .../interpret`，失败展示重试）。

### 3.3 详情页（编辑 / 删除 / AI 解读 / 分享）

- **展示**：正文、标签、最新解读三块（骨架屏）。
- **编辑**：`PATCH /entries/:id`。
- **删除**：二次确认后 `DELETE`，软删后列表同步移除。
- **解读**：若尚无解读，展示「生成解读」按钮；加载中流式（若后端 SSE/WebSocket 未上，则用轮询或一次性 JSON）。
- **分享**：使用 **小程序 `onShareAppMessage`** 携带 `entryId`；分享卡片图用 **Canvas** 绘制句子 + 品牌样式，导出临时文件路径给分享接口（具体 API 以微信文档为准）。

### 3.4 个人中心（统计 / 会员）

- `GET /stats/summary`：总收藏、本周新增、解读使用率等（与后端字段对齐）。
- 会员：展示当前 `plan`，Pro 能力说明；支付按钮可灰显「即将开放」。

### 3.5 每日随机回顾

- Tab 或首页模块：调用 `GET /entries/daily-random`，展示一条 + 跳转详情。

---

## 4. 与后端的契约

- **环境**：`config/dev.ts`、`config/prod.ts` 中配置 `API_BASE_URL`。
- **类型**：与后端约定 OpenAPI / 手写 `types/api.d.ts`，对 `Entry`、`User`、`Interpretation` 建 TS 接口。
- **错误**：统一 `code` + `message`，前端 toast 展示；网络错误单独文案。

---

## 5. 小程序审核与合规注意点

- **用户协议与隐私政策**：在登录页或个人中心可访问；涉及 OCR 图片、AI 分析需在隐私声明中说明用途与存储期限。
- **内容安全**：敏感词与 UGC 策略按平台要求；AI 输出建议后端过审或前端风险提示。
- **域名**：request 合法域名、uploadFile 域名、socket 域名在微信后台配置。

---

## 6. 后续扩展 App（React Native）

- **复用**：`services/*`、`types/*`、纯函数工具可抽到 `packages/core`（monorepo）或复制后对齐接口。
- **差异**：登录改为 App 侧微信 SDK / 手机号；存储用 AsyncStorage；路由用 React Navigation。业务状态层尽量与 UI 解耦以便迁移。

---

## 7. 与 PRD 排期对应

- **第 1 周**：微信登录链路、`entries` 列表/搜索/CRUD 页面、`me` 与 tab 骨架。
- **第 2 周**：选图 OCR 流程、标签展示、解读展示与重试、分享卡片 Canvas、个人中心统计、提审前自检清单。

更细的组件拆分与 UI 稿对齐后，可在本文件追加「组件清单」与「路由表」两节。
