"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const wechat_1 = require("../lib/wechat");
const jwt_1 = require("../lib/jwt");
const userService_1 = require("../services/userService");
const requireAuth_1 = require("../middleware/requireAuth");
const httpError_1 = require("../lib/httpError");
const config_1 = require("../config");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/wechat/login", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!code) {
        throw new httpError_1.HttpError(400, "VALIDATION", "缺少 code");
    }
    const { openid, unionid } = await (0, wechat_1.exchangeCode)(code);
    const user = await (0, userService_1.findOrCreateByWechat)(openid, unionid);
    const accessToken = (0, jwt_1.signAccessToken)(user.id);
    res.json({
        accessToken,
        expiresInDays: config_1.config.jwtExpiresDays,
        user: {
            id: user.id,
            nickname: user.nickname,
            avatarUrl: user.avatar_url,
            plan: user.plan,
            entryCount: user.entry_count,
        },
    });
}));
