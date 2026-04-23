import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db";
import { asyncHandler, requireAuth, type AuthedRequest } from "../middleware/requireAuth";

export const tagsRouter = Router();
tagsRouter.use(requireAuth);

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
