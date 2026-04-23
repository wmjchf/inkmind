import dotenv from "dotenv";

dotenv.config();

const n = (v: string | undefined, d: number) => (v ? parseInt(v, 10) : d) || d;

export const config = {
  port: n(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || "development",
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
    appId: process.env.WECHAT_APPID || "",
    appSecret: process.env.WECHAT_APPSECRET || "",
    devMock: process.env.WECHAT_DEV_MOCK === "1",
  },
  freeEntryLimit: n(process.env.FREE_ENTRY_LIMIT, 100),
};
