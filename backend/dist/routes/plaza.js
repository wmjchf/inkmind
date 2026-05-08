"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plazaRouter = void 0;
const express_1 = require("express");
const requireAuth_1 = require("../middleware/requireAuth");
const entryService_1 = require("../services/entryService");
exports.plazaRouter = (0, express_1.Router)();
exports.plazaRouter.use(requireAuth_1.requireAuth);
function parseIntParam(v, def, max) {
    const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : def;
    if (!Number.isFinite(n) || n < 1)
        return def;
    if (max !== undefined && n > max)
        return max;
    return n;
}
exports.plazaRouter.get("/", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const page = parseIntParam(req.query.page, 1, 10_000);
    const pageSize = parseIntParam(req.query.pageSize, 20, 50);
    const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const q = qRaw.length ? qRaw : undefined;
    const { items, total } = await (0, entryService_1.listPlazaFeed)({ page, pageSize, q });
    res.json({
        items,
        total,
        page,
        pageSize,
    });
}));
