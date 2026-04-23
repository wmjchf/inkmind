import { Router } from "express";
import { asyncHandler, requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { getUserById } from "../services/userService";
import { config } from "../config";

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const user = await getUserById(userId);
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
      freeEntryLimit: user.plan === "free" ? config.freeEntryLimit : null,
    });
  })
);
