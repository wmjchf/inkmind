"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const config_1 = require("./config");
exports.pool = promise_1.default.createPool({
    host: config_1.config.mysql.host,
    port: config_1.config.mysql.port,
    user: config_1.config.mysql.user,
    password: config_1.config.mysql.password,
    database: config_1.config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
});
