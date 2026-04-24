"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const requireAuth_1 = require("../middleware/requireAuth");
exports.statsRouter = (0, express_1.Router)();
exports.statsRouter.use(requireAuth_1.requireAuth);
exports.statsRouter.get("/summary", (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const userId = req.userId;
    const [totalRows] = await db_1.pool.query(`SELECT COUNT(*) AS c FROM entries WHERE user_id = :userId AND is_deleted = 0`, { userId });
    const [weekRows] = await db_1.pool.query(`SELECT COUNT(*) AS c FROM entries
       WHERE user_id = :userId AND is_deleted = 0
         AND created_at >= (NOW() - INTERVAL 7 DAY)`, { userId });
    const [interpRows] = await db_1.pool.query(`SELECT COUNT(DISTINCT ai.entry_id) AS c
       FROM ai_interpretations ai
       JOIN entries e ON e.id = ai.entry_id AND e.user_id = :userId AND e.is_deleted = 0`, { userId });
    const totalEntries = Number(totalRows[0]?.c || 0);
    const entriesLast7d = Number(weekRows[0]?.c || 0);
    const entriesWithInterpretation = Number(interpRows[0]?.c || 0);
    const interpretationRate = totalEntries === 0 ? 0 : Math.round((entriesWithInterpretation / totalEntries) * 1000) / 1000;
    res.json({
        totalEntries,
        entriesLast7d,
        entriesWithInterpretation,
        interpretationRate,
    });
}));
