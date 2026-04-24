"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInitSchema = runInitSchema;
exports.maybeAutoInitDb = maybeAutoInitDb;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promise_1 = __importDefault(require("mysql2/promise"));
const config_1 = require("../config");
/** 默认使用 backend/schema.sql（相对本文件或 cwd） */
function resolveSchemaPath() {
    if (process.env.SCHEMA_PATH) {
        const p = path_1.default.resolve(process.env.SCHEMA_PATH);
        if (!fs_1.default.existsSync(p)) {
            throw new Error(`SCHEMA_PATH 指向的文件不存在: ${p}`);
        }
        return p;
    }
    const besideSrc = path_1.default.join(__dirname, "..", "..", "schema.sql");
    if (fs_1.default.existsSync(besideSrc))
        return besideSrc;
    const cwdBackend = path_1.default.join(process.cwd(), "schema.sql");
    if (fs_1.default.existsSync(cwdBackend))
        return cwdBackend;
    const cwdFromRoot = path_1.default.join(process.cwd(), "backend", "schema.sql");
    if (fs_1.default.existsSync(cwdFromRoot))
        return cwdFromRoot;
    throw new Error("找不到 backend/schema.sql。请在 backend 目录执行命令，或设置 SCHEMA_PATH 为 SQL 文件绝对路径。");
}
/**
 * 执行 schema.sql（CREATE DATABASE / USE / CREATE TABLE）。
 * 使用不指定默认库的连接，以便在库尚未创建时也能执行。
 */
async function runInitSchema() {
    const sql = fs_1.default.readFileSync(resolveSchemaPath(), "utf8");
    const conn = await promise_1.default.createConnection({
        host: config_1.config.mysql.host,
        port: config_1.config.mysql.port,
        user: config_1.config.mysql.user,
        password: config_1.config.mysql.password,
        multipleStatements: true,
    });
    try {
        await conn.query(sql);
    }
    finally {
        await conn.end();
    }
}
/** 开发可选：AUTO_INIT_DB=1 且 NODE_ENV=development 时在启动前建库表 */
async function maybeAutoInitDb() {
    if (config_1.config.nodeEnv !== "development")
        return;
    if (process.env.AUTO_INIT_DB !== "1")
        return;
    console.log("[db] AUTO_INIT_DB=1，正在执行 schema…");
    await runInitSchema();
    console.log("[db] schema 执行完成");
}
