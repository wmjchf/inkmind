"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.asyncHandler = asyncHandler;
exports.errorMiddleware = errorMiddleware;
const jwt_1 = require("../lib/jwt");
const httpError_1 = require("../lib/httpError");
function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return res.status(401).json({ code: "UNAUTHORIZED", message: "缺少登录凭证" });
    }
    try {
        const { userId } = (0, jwt_1.verifyAccessToken)(m[1]);
        req.userId = userId;
        return next();
    }
    catch {
        return res.status(401).json({ code: "TOKEN_INVALID", message: "登录已失效，请重新登录" });
    }
}
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
function errorMiddleware(err, _req, res, _next) {
    if (err instanceof httpError_1.HttpError) {
        return res.status(err.status).json({ code: err.code, message: err.message });
    }
    console.error(err);
    return res.status(500).json({ code: "INTERNAL", message: "服务器错误" });
}
