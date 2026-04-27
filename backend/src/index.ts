import fs from "fs";
import https from "https";
import { createApp } from "./app";
import { config } from "./config";
import { maybeAutoInitDb } from "./db/initSchema";

async function main() {
  await maybeAutoInitDb();
  const app = createApp();

  if (config.ssl.enabled) {
    const credentials = {
      key: fs.readFileSync(config.ssl.keyPath),
      cert: fs.readFileSync(config.ssl.certPath),
    };
    const httpServer = https.createServer(credentials, app);
    // 显式绑定 IPv4 全网卡；部分环境下仅 `listen(port)` 时公网 IPv4 连不上而 127.0.0.1 正常
    httpServer.listen(config.port, "0.0.0.0", () => {
      console.log(`InkMind API listening on https://0.0.0.0:${config.port}`);
    });
    httpServer.on("error", (err) => {
      console.error("❌ HTTPS 服务启动失败", err);
      process.exit(1);
    });
  } else {
    // 仅本机：配合 Nginx 等反代终止 TLS，避免应用端口对公网直连暴露
    const server = app.listen(config.port, "127.0.0.1", () => {
      console.log(`InkMind API listening on http://127.0.0.1:${config.port}`);
    });
    server.on("error", (err) => {
      console.error("❌ HTTP 服务启动失败", err);
      process.exit(1);
    });
  }
}

void main();
