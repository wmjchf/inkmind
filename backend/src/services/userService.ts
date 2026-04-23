import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "../db";

export type UserRow = {
  id: number;
  wechat_openid: string;
  wechat_unionid: string | null;
  nickname: string | null;
  avatar_url: string | null;
  plan: "free" | "pro";
  entry_count: number;
  ocr_count_month: number;
};

export async function findOrCreateByWechat(
  openid: string,
  unionid: string | null
): Promise<UserRow> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, wechat_openid, wechat_unionid, nickname, avatar_url, plan, entry_count, ocr_count_month
     FROM users WHERE wechat_openid = :openid LIMIT 1`,
    { openid }
  );
  if (rows.length) {
    const u = rows[0] as UserRow;
    if (unionid && !u.wechat_unionid) {
      await pool.query(`UPDATE users SET wechat_unionid = :unionid WHERE id = :id`, {
        unionid,
        id: u.id,
      });
      u.wechat_unionid = unionid;
    }
    return u;
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (wechat_openid, wechat_unionid) VALUES (:openid, :unionid)`,
    { openid, unionid }
  );
  const id = result.insertId;
  const [created] = await pool.query<RowDataPacket[]>(
    `SELECT id, wechat_openid, wechat_unionid, nickname, avatar_url, plan, entry_count, ocr_count_month
     FROM users WHERE id = :id`,
    { id }
  );
  return created[0] as UserRow;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, wechat_openid, wechat_unionid, nickname, avatar_url, plan, entry_count, ocr_count_month
     FROM users WHERE id = :id LIMIT 1`,
    { id }
  );
  return rows.length ? (rows[0] as UserRow) : null;
}
