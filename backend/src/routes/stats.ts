import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db";
import { asyncHandler, requireAuth, type AuthedRequest } from "../middleware/requireAuth";

export const statsRouter = Router();
statsRouter.use(requireAuth);

statsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;

    const [totalRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM entries WHERE user_id = :userId AND is_deleted = 0`,
      { userId }
    );
    const [weekRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM entries
       WHERE user_id = :userId AND is_deleted = 0
         AND created_at >= (NOW() - INTERVAL 7 DAY)`,
      { userId }
    );
    const [interpRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT ai.entry_id) AS c
       FROM ai_interpretations ai
       JOIN entries e ON e.id = ai.entry_id AND e.user_id = :userId AND e.is_deleted = 0`,
      { userId }
    );

    const totalEntries = Number(totalRows[0]?.c || 0);
    const entriesLast7d = Number(weekRows[0]?.c || 0);
    const entriesWithInterpretation = Number(interpRows[0]?.c || 0);
    const interpretationRate =
      totalEntries === 0 ? 0 : Math.round((entriesWithInterpretation / totalEntries) * 1000) / 1000;

    res.json({
      totalEntries,
      entriesLast7d,
      entriesWithInterpretation,
      interpretationRate,
    });
  })
);
