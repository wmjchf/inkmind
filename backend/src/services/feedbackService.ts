import { ResultSetHeader } from "mysql2";
import { pool } from "../db";
import { HttpError } from "../lib/httpError";

export async function createFeedback(
  userId: number,
  body: { content: string; contact: string | null }
): Promise<number> {
  const content = body.content.trim();
  if (!content) throw new HttpError(400, "VALIDATION", "反馈内容不能为空");
  if (content.length > 2000) throw new HttpError(400, "VALIDATION", "反馈内容最多 2000 字");

  let contact: string | null = null;
  if (body.contact != null && String(body.contact).trim()) {
    const c = String(body.contact).trim().slice(0, 120);
    contact = c.length ? c : null;
  }

  const [ins] = await pool.query<ResultSetHeader>(
    `INSERT INTO feedbacks (user_id, content, contact) VALUES (:userId, :content, :contact)`,
    { userId, content, contact }
  );
  return ins.insertId;
}
