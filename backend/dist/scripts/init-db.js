"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const initSchema_1 = require("../db/initSchema");
void (0, initSchema_1.runInitSchema)()
    .then(() => {
    console.log("数据库初始化完成（已执行 backend/schema.sql）。");
    process.exit(0);
})
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
