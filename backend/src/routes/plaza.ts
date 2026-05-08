import { Router } from "express";
import { asyncHandler, requireAuth } from "../middleware/requireAuth";
import { listPlazaFeed } from "../services/entryService";

export const plazaRouter = Router();
plazaRouter.use(requireAuth);

function parseIntParam(v: unknown, def: number, max?: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : def;
  if (!Number.isFinite(n) || n < 1) return def;
  if (max !== undefined && n > max) return max;
  return n;
}

plazaRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = parseIntParam(req.query.page, 1, 10_000);
    const pageSize = parseIntParam(req.query.pageSize, 20, 50);
    const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const q = qRaw.length ? qRaw : undefined;
    const { items, total } = await listPlazaFeed({ page, pageSize, q });
    res.json({
      items,
      total,
      page,
      pageSize,
    });
  })
);
