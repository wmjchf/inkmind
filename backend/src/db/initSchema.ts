import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { config } from "../config";

/** 默认使用 backend/schema.sql（相对本文件或 cwd） */
function resolveSchemaPath(): string {
  if (process.env.SCHEMA_PATH) {
    const p = path.resolve(process.env.SCHEMA_PATH);
    if (!fs.existsSync(p)) {
      throw new Error(`SCHEMA_PATH 指向的文件不存在: ${p}`);
    }
    return p;
  }
  const besideSrc = path.join(__dirname, "..", "..", "schema.sql");
  if (fs.existsSync(besideSrc)) return besideSrc;
  const cwdBackend = path.join(process.cwd(), "schema.sql");
  if (fs.existsSync(cwdBackend)) return cwdBackend;
  const cwdFromRoot = path.join(process.cwd(), "backend", "schema.sql");
  if (fs.existsSync(cwdFromRoot)) return cwdFromRoot;
  throw new Error(
    "找不到 backend/schema.sql。请在 backend 目录执行命令，或设置 SCHEMA_PATH 为 SQL 文件绝对路径。"
  );
}

/**
 * 执行 schema.sql（CREATE DATABASE / USE / CREATE TABLE）。
 * 使用不指定默认库的连接，以便在库尚未创建时也能执行。
 */
export async function runInitSchema(): Promise<void> {
  const sql = fs.readFileSync(resolveSchemaPath(), "utf8");
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
  } finally {
    await conn.end();
  }
}

/** 开发可选：AUTO_INIT_DB=1 且 NODE_ENV=development 时在启动前建库表 */
export async function maybeAutoInitDb(): Promise<void> {
  if (config.nodeEnv !== "development") return;
  if (process.env.AUTO_INIT_DB !== "1") return;
  console.log("[db] AUTO_INIT_DB=1，正在执行 schema…");
  await runInitSchema();
  console.log("[db] schema 执行完成");
}
