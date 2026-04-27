"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entriesRouter = void 0;
const express_1 = require("express");
const requireAuth_1 = require("../middleware/requireAuth");
const entryService_1 = require("../services/entryService");
const wechatWxacode_1 = require("../services/wechatWxacode");
const config_1 = require("../config");
const httpError_1 = require("../lib/httpError");
exports.entriesRouter = (0, express_1.Router)();
exports.entriesRouter.use(requireAuth_1.requireAuth);
function parseIntParam(v, def, max) {
    const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : def;
    if (!Number.isFinite(n) || n < 1)
        return def;
    if (max !== undefined && n > max)
        return max;
    return n;
}
exports.entriesRouter.get("/daily-random", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const item = await (0, entryService_1.randomEntry)(userId);
    if (!item) {
        return res.status(404).json({ code: "EMPTY", message: "还没有收藏，先去添加一条吧" });
    }
    res.json({ item });
}));
exports.entriesRouter.get("/", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const page = parseIntParam(req.query.page, 1, 10_000);
    const pageSize = parseIntParam(req.query.pageSize, 20, 50);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const tagId = req.query.tagId !== undefined
        ? parseIntParam(req.query.tagId, 0)
        : undefined;
    const tid = tagId && tagId > 0 ? tagId : undefined;
    const bookTitle = typeof req.query.bookTitle === "string" ? req.query.bookTitle.trim() : undefined;
    const bt = bookTitle || undefined;
    const { items, total } = await (0, entryService_1.listEntries)(userId, {
        page,
        pageSize,
        q,
        tagId: tid,
        bookTitle: bt,
    });
    res.json({ items, total, page, pageSize });
}));
exports.entriesRouter.get("/book-titles", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const items = await (0, entryService_1.listDistinctBookTitles)(userId);
    res.json({ items });
}));
exports.entriesRouter.post("/", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const body = req.body || {};
    const id = await (0, entryService_1.createEntry)(userId, {
        content: body.content,
        sourceType: body.sourceType,
        bookTitle: body.bookTitle,
        note: body.note,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    });
    res.status(201).json({ id });
}));
/** 必须在 `GET /:id` 之前注册，否则 `wxacode` 会被当成 id */
exports.entriesRouter.get("/:id/wxacode", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id)
        throw new httpError_1.HttpError(400, "VALIDATION", "无效 id");
    const detail = await (0, entryService_1.getEntryDetail)(userId, id);
    if (!detail) {
        return res.status(404).json({ code: "NOT_FOUND", message: "收藏不存在" });
    }
    if (config_1.config.wechat.devMock) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "private, no-store");
        res.send((0, wechatWxacode_1.mockWxacodePng)());
        return;
    }
    const png = await (0, wechatWxacode_1.getUnlimitedWxacodePng)(id);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(png);
}));
exports.entriesRouter.get("/:id", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id)
        throw new httpError_1.HttpError(400, "VALIDATION", "无效 id");
    const detail = await (0, entryService_1.getEntryDetail)(userId, id);
    if (!detail) {
        return res.status(404).json({ code: "NOT_FOUND", message: "收藏不存在" });
    }
    res.json(detail);
}));
exports.entriesRouter.patch("/:id", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id)
        throw new httpError_1.HttpError(400, "VALIDATION", "无效 id");
    const body = req.body || {};
    const ok = await (0, entryService_1.updateEntry)(userId, id, {
        content: body.content,
        bookTitle: body.bookTitle,
        note: body.note,
        tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags.map(String) : []) : undefined,
    });
    if (!ok) {
        return res.status(404).json({ code: "NOT_FOUND", message: "收藏不存在" });
    }
    res.json({ ok: true });
}));
exports.entriesRouter.delete("/:id", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id)
        throw new httpError_1.HttpError(400, "VALIDATION", "无效 id");
    const ok = await (0, entryService_1.softDeleteEntry)(userId, id);
    if (!ok) {
        return res.status(404).json({ code: "NOT_FOUND", message: "收藏不存在" });
    }
    res.json({ ok: true });
}));
function parseAiTagStrategy(v) {
    if (v === "append_if_empty" || v === "replace_ai_only" || v === "merge")
        return v;
    return "merge";
}
exports.entriesRouter.post("/:id/tags/ai", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id)
        throw new httpError_1.HttpError(400, "VALIDATION", "无效 id");
    const body = req.body || {};
    const strategy = parseAiTagStrategy(body.strategy);
    const result = await (0, entryService_1.applyAiTags)(userId, id, strategy);
    res.json(result);
}));
exports.entriesRouter.post("/:id/interpret", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id)
        throw new httpError_1.HttpError(400, "VALIDATION", "无效 id");
    const interpretation = await (0, entryService_1.runInterpretation)(userId, id);
    res.json({ interpretation });
}));
exports.entriesRouter.post("/:id/ocr", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id)
        throw new httpError_1.HttpError(400, "VALIDATION", "无效 id");
    await (0, entryService_1.runOcr)(userId, id);
}));
