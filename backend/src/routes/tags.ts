import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db";
import { HttpError } from "../lib/httpError";
import { asyncHandler, requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { suggestTagsFromContent } from "../services/aiTagSuggest";

export const tagsRouter = Router();
tagsRouter.use(requireAuth);

/** 仅根据正文建议标签，不落库；用于添加页保存前 */
tagsRouter.post(
  "/suggest",
  asyncHandler(async (req, res) => {
    const body = req.body as { content?: unknown; existing?: unknown; bookTitle?: unknown };
    const content = typeof body.content === "string" ? body.content : "";
    const bookTitle = typeof body.bookTitle === "string" ? body.bookTitle : undefined;
    const existingRaw = body.existing;
    const existing: string[] = Array.isArray(existingRaw)
      ? existingRaw.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (!content.trim()) {
      throw new HttpError(400, "VALIDATION", "请先填写内容");
    }
    const tags = await suggestTagsFromContent(content, existing, bookTitle);
    res.json({ tags });
  })
);

tagsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT t.id, t.name
       FROM tags t
       INNER JOIN entry_tags et ON et.tag_id = t.id
       INNER JOIN entries e ON e.id = et.entry_id AND e.user_id = :userId AND e.is_deleted = 0
       WHERE t.user_id = :userId
       ORDER BY t.name ASC`,
      { userId }
    );
    res.json({
      items: rows.map((r) => ({ id: r.id, name: r.name })),
    });
  })
);
