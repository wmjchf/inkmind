import { Router } from "express";
import { exchangeCode } from "../lib/wechat";
import { signAccessToken } from "../lib/jwt";
import { findOrCreateByWechat } from "../services/userService";
import { asyncHandler } from "../middleware/requireAuth";
import { HttpError } from "../lib/httpError";
import { config } from "../config";

export const authRouter = Router();

authRouter.post(
  "/wechat/login",
  asyncHandler(async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!code) {
      throw new HttpError(400, "VALIDATION", "缺少 code");
    }

    const { openid, unionid } = await exchangeCode(code);
    const user = await findOrCreateByWechat(openid, unionid);
    const accessToken = signAccessToken(user.id);

    res.json({
      accessToken,
      expiresInDays: config.jwtExpiresDays,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        plan: user.plan,
        entryCount: user.entry_count,
      },
    });
  })
);
