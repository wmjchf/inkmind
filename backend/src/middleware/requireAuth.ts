import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { HttpError } from "../lib/httpError";

export type AuthedRequest = Request & { userId: number };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "缺少登录凭证" });
  }
  try {
    const { userId } = verifyAccessToken(m[1]);
    (req as AuthedRequest).userId = userId;
    return next();
  } catch {
    return res.status(401).json({ code: "TOKEN_INVALID", message: "登录已失效，请重新登录" });
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ code: err.code, message: err.message });
  }
  console.error(err);
  return res.status(500).json({ code: "INTERNAL", message: "服务器错误" });
}
