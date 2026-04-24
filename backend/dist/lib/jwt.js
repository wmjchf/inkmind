"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.verifyAccessToken = verifyAccessToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
function signAccessToken(userId) {
    return jsonwebtoken_1.default.sign({ sub: String(userId) }, config_1.config.jwtSecret, {
        expiresIn: `${config_1.config.jwtExpiresDays}d`,
    });
}
function verifyAccessToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
    if (typeof decoded !== "object" || decoded === null)
        throw new Error("invalid token");
    const sub = decoded.sub;
    if (!sub)
        throw new Error("invalid token");
    const userId = parseInt(String(sub), 10);
    if (!Number.isFinite(userId))
        throw new Error("invalid token");
    return { userId };
}
