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
        https_1.default.createServer(credentials, app).listen(config_1.config.port, () => {
            console.log(`InkMind API listening on https://0.0.0.0:${config_1.config.port}`);
        });
    }
    else {
        app.listen(config_1.config.port, () => {
            console.log(`InkMind API listening on http://127.0.0.1:${config_1.config.port}`);
        });
    }
}
void main();
