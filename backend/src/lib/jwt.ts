import jwt from "jsonwebtoken";
import { config } from "../config";

export function signAccessToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, {
    expiresIn: `${config.jwtExpiresDays}d`,
  });
}

export function verifyAccessToken(token: string): { userId: number } {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded !== "object" || decoded === null) throw new Error("invalid token");
  const sub = (decoded as jwt.JwtPayload).sub;
  if (!sub) throw new Error("invalid token");
  const userId = parseInt(String(sub), 10);
  if (!Number.isFinite(userId)) throw new Error("invalid token");
  return { userId };
}
