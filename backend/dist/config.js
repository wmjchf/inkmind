"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const n = (v, d) => (v ? parseInt(v, 10) : d) || d;
const sslCertPath = (process.env.SSL_CERT_PATH || "").trim();
const sslKeyPath = (process.env.SSL_KEY_PATH || "").trim();
exports.config = {
    port: n(process.env.PORT, 3000),
    nodeEnv: process.env.NODE_ENV || "development",
    /** 同时配置 SSL_CERT_PATH + SSL_KEY_PATH（PEM，如 Let’s Encrypt 的 fullchain.pem / privkey.pem）时走 https.createServer */
    ssl: sslCertPath && sslKeyPath
        ? { enabled: true, certPath: sslCertPath, keyPath: sslKeyPath }
        : { enabled: false, certPath: "", keyPath: "" },
    mysql: {
        host: process.env.MYSQL_HOST || "127.0.0.1",
        port: n(process.env.MYSQL_PORT, 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || "inkmind",
    },
    jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
    jwtExpiresDays: n(process.env.JWT_EXPIRES_DAYS, 7),
    wechat: {
        appId: (process.env.WECHAT_APPID || "").trim(),
        appSecret: (process.env.WECHAT_APPSECRET || "").trim(),
        devMock: process.env.WECHAT_DEV_MOCK === "1",
        /** 生成小程序码时 env_version：release | trial | develop（未发布页面试 develop） */
        miniEnvVersion: (() => {
            const v = (process.env.WECHAT_MINI_ENV_VERSION || "release").trim();
            if (v === "trial" || v === "develop" || v === "release")
                return v;
            return "release";
        })(),
    },
    freeEntryLimit: n(process.env.FREE_ENTRY_LIMIT, 100),
    /** 阿里云文字识别（无 Node SDK 时用 OpenAPI + 自签名） */
    aliyunOcr: {
        accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
        accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
        endpoint: process.env.ALIYUN_OCR_ENDPOINT || "ocr-api.cn-hangzhou.aliyuncs.com",
    },
};
