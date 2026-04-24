"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meRouter = void 0;
const express_1 = require("express");
const requireAuth_1 = require("../middleware/requireAuth");
const userService_1 = require("../services/userService");
const config_1 = require("../config");
exports.meRouter = (0, express_1.Router)();
exports.meRouter.use(requireAuth_1.requireAuth);
exports.meRouter.get("/", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const user = await (0, userService_1.getUserById)(userId);
    if (!user) {
        return res.status(404).json({ code: "NOT_FOUND", message: "用户不存在" });
    }
    res.json({
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        plan: user.plan,
        entryCount: user.entry_count,
        ocrCountMonth: user.ocr_count_month,
        freeEntryLimit: user.plan === "free" ? config_1.config.freeEntryLimit : null,
    });
}));
