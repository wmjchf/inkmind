"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const httpError_1 = require("../lib/httpError");
const requireAuth_1 = require("../middleware/requireAuth");
const aiTagSuggest_1 = require("../services/aiTagSuggest");
exports.tagsRouter = (0, express_1.Router)();
exports.tagsRouter.use(requireAuth_1.requireAuth);
/** 仅根据正文建议标签，不落库；用于添加页保存前 */
exports.tagsRouter.post("/suggest", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const content = typeof body.content === "string" ? body.content : "";
    const bookTitle = typeof body.bookTitle === "string" ? body.bookTitle : undefined;
    const existingRaw = body.existing;
    const existing = Array.isArray(existingRaw)
        ? existingRaw.map((x) => String(x).trim()).filter(Boolean)
        : [];
    if (!content.trim()) {
        throw new httpError_1.HttpError(400, "VALIDATION", "请先填写内容");
    }
    const tags = await (0, aiTagSuggest_1.suggestTagsFromContent)(content, existing, bookTitle);
    res.json({ tags });
}));
exports.tagsRouter.get("/", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const [rows] = await db_1.pool.query(`SELECT DISTINCT t.id, t.name
       FROM tags t
       INNER JOIN entry_tags et ON et.tag_id = t.id
       INNER JOIN entries e ON e.id = et.entry_id AND e.user_id = :userId AND e.is_deleted = 0
       WHERE t.user_id = :userId
       ORDER BY t.name ASC`, { userId });
    res.json({
        items: rows.map((r) => ({ id: r.id, name: r.name })),
    });
}));
