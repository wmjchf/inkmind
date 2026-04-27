"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const app_1 = require("./app");
const config_1 = require("./config");
const initSchema_1 = require("./db/initSchema");
async function main() {
    await (0, initSchema_1.maybeAutoInitDb)();
    const app = (0, app_1.createApp)();
    if (config_1.config.ssl.enabled) {
        const credentials = {
            key: fs_1.default.readFileSync(config_1.config.ssl.keyPath),
            cert: fs_1.default.readFileSync(config_1.config.ssl.certPath),
        };
        const httpServer = https_1.default.createServer(credentials, app);
        // 显式绑定 IPv4 全网卡；部分环境下仅 `listen(port)` 时公网 IPv4 连不上而 127.0.0.1 正常
        httpServer.listen(config_1.config.port, "0.0.0.0", () => {
            console.log(`InkMind API listening on https://0.0.0.0:${config_1.config.port}`);
        });
        httpServer.on("error", (err) => {
            console.error("❌ HTTPS 服务启动失败", err);
            process.exit(1);
        });
    }
    else {
        // 仅本机：配合 Nginx 等反代终止 TLS，避免应用端口对公网直连暴露
        const server = app.listen(config_1.config.port, "127.0.0.1", () => {
            console.log(`InkMind API listening on http://127.0.0.1:${config_1.config.port}`);
        });
        server.on("error", (err) => {
            console.error("❌ HTTP 服务启动失败", err);
            process.exit(1);
        });
    }
}
void main();
