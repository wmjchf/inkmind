import { Router } from "express";
import { asyncHandler, requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import {
  listEntries,
  listDistinctBookTitles,
  getEntryDetail,
  createEntry,
  updateEntry,
  softDeleteEntry,
  randomEntry,
  runInterpretation,
  runOcr,
  applyAiTags,
  type AiTagStrategy,
} from "../services/entryService";
import { getUnlimitedWxacodePng, mockWxacodePng } from "../services/wechatWxacode";
import { config } from "../config";
import { HttpError } from "../lib/httpError";

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

function parseIntParam(v: unknown, def: number, max?: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : def;
  if (!Number.isFinite(n) || n < 1) return def;
  if (max !== undefined && n > max) return max;
  return n;
}

entriesRouter.get(
  "/daily-random",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const item = await randomEntry(userId);
    if (!item) {
      return res.status(404).json({ code: "EMPTY", message: "还没有收藏，先去添加一条吧" });
    }
    res.json({ item });
  })
);

entriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const page = parseIntParam(req.query.page, 1, 10_000);
    const pageSize = parseIntParam(req.query.pageSize, 20, 50);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const tagId =
      req.query.tagId !== undefined
        ? parseIntParam(req.query.tagId, 0)
        : undefined;
    const tid = tagId && tagId > 0 ? tagId : undefined;

    const bookTitle =
      typeof req.query.bookTitle === "string" ? req.query.bookTitle.trim() : undefined;
    const bt = bookTitle || undefined;

    const { items, total } = await listEntries(userId, {
      page,
      pageSize,
      q,
      tagId: tid,
      bookTitle: bt,
    });
    res.json({ items, total, page, pageSize });
  })
);

entriesRouter.get(
  "/book-titles",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const items = await listDistinctBookTitles(userId);
    res.json({ items });
  })
);

entriesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const body = req.body || {};
    const id = await createEntry(userId, {
      content: body.content,
      sourceType: body.sourceType,
      bookTitle: body.bookTitle,
      note: body.note,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    });
    res.status(201).json({ id });
  })
);

/** 必须在 `GET /:id` 之前注册，否则 `wxacode` 会被当成 id */
entriesRouter.get(
  "/:id/wxacode",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id) throw new HttpError(400, "VALIDATION", "无效 id");
    const detail = await getEntryDetail(userId, id);
    if (!detail) {
      return res.status(404).json({ code: "NOT_FOUND", message: "收藏不存在" });
    }
    if (config.wechat.devMock) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "private, no-store");
      res.send(mockWxacodePng());
      return;
    }
    const png = await getUnlimitedWxacodePng(id);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(png);
  })
);

entriesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id) throw new HttpError(400, "VALIDATION", "无效 id");
    const detail = await getEntryDetail(userId, id);
    if (!detail) {
      return res.status(404).json({ code: "NOT_FOUND", message: "收藏不存在" });
    }
    res.json(detail);
  })
);

entriesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id) throw new HttpError(400, "VALIDATION", "无效 id");
    const body = req.body || {};
    const ok = await updateEntry(userId, id, {
      content: body.content,
      bookTitle: body.bookTitle,
      note: body.note,
      tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags.map(String) : []) : undefined,
    });
    if (!ok) {
      return res.status(404).json({ code: "NOT_FOUND", message: "收藏不存在" });
    }
    res.json({ ok: true });
  })
);

entriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id) throw new HttpError(400, "VALIDATION", "无效 id");
    const ok = await softDeleteEntry(userId, id);
    if (!ok) {
      return res.status(404).json({ code: "NOT_FOUND", message: "收藏不存在" });
    }
    res.json({ ok: true });
  })
);

function parseAiTagStrategy(v: unknown): AiTagStrategy {
  if (v === "append_if_empty" || v === "replace_ai_only" || v === "merge") return v;
  return "merge";
}

entriesRouter.post(
  "/:id/tags/ai",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id) throw new HttpError(400, "VALIDATION", "无效 id");
    const body = req.body || {};
    const strategy = parseAiTagStrategy(body.strategy);
    const result = await applyAiTags(userId, id, strategy);
    res.json(result);
  })
);

entriesRouter.post(
  "/:id/interpret",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id) throw new HttpError(400, "VALIDATION", "无效 id");
    const interpretation = await runInterpretation(userId, id);
    res.json({ interpretation });
  })
);

entriesRouter.post(
  "/:id/ocr",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const id = parseIntParam(req.params.id, 0);
    if (!id) throw new HttpError(400, "VALIDATION", "无效 id");
    await runOcr(userId, id);
  })
);
