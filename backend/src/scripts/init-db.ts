import { runInitSchema } from "../db/initSchema";

void runInitSchema()
  .then(() => {
    console.log("数据库初始化完成（已执行 backend/schema.sql）。");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
