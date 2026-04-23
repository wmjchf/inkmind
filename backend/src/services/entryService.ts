import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "../db";
import { config } from "../config";
import { HttpError } from "../lib/httpError";

export type EntrySource = "manual" | "ocr";

export type EntryListItem = {
  id: number;
  content: string;
  source_type: EntrySource;
  book_title: string | null;
  note: string | null;
  created_at: Date;
  tags: { id: number; name: string }[];
};

export type Interpretation = {
  id: number;
  summary: string;
  resonance: string;
  reflection_question: string;
  created_at: Date;
};

async function linkTagsByNames(
  conn: import("mysql2/promise").PoolConnection,
  userId: number,
  entryId: number,
  tagNames: string[]
): Promise<void> {
  const names = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  for (const name of names) {
    await conn.query(
      `INSERT INTO tags (user_id, name, created_by) VALUES (:userId, :name, 'user')
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      { userId, name }
    );
    const [rows] = await conn.query<RowDataPacket[]>("SELECT LAST_INSERT_ID() AS id");
    const tagId = Number(rows[0]?.id);
    if (!Number.isFinite(tagId) || tagId <= 0) continue;
    await conn.query(
      `INSERT IGNORE INTO entry_tags (entry_id, tag_id) VALUES (:entryId, :tagId)`,
      { entryId, tagId }
    );
  }
}

export async function listEntries(
  userId: number,
  opts: { page: number; pageSize: number; q?: string; tagId?: number }
): Promise<{ items: EntryListItem[]; total: number }> {
  const offset = (opts.page - 1) * opts.pageSize;
  const params: Record<string, string | number> = { userId, offset, limit: opts.pageSize };

  let where = "e.user_id = :userId AND e.is_deleted = 0";
  if (opts.q) {
    where += " AND e.content LIKE :likeQ";
    params.likeQ = `%${opts.q}%`;
  }
  if (opts.tagId) {
    where += " AND EXISTS (SELECT 1 FROM entry_tags et WHERE et.entry_id = e.id AND et.tag_id = :tagId)";
    params.tagId = opts.tagId;
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM entries e WHERE ${where}`,
    params
  );
  const total = Number(countRows[0]?.c || 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.content, e.source_type, e.book_title, e.note, e.created_at
     FROM entries e
     WHERE ${where}
     ORDER BY e.created_at DESC
     LIMIT :limit OFFSET :offset`,
    params
  );

  const ids = rows.map((r) => r.id as number);
  const tagMap = new Map<number, { id: number; name: string }[]>();
  if (ids.length) {
    const [tagRows] = await pool.query<RowDataPacket[]>(
      `SELECT et.entry_id AS entry_id, t.id AS tag_id, t.name AS tag_name
       FROM entry_tags et
       JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    for (const tr of tagRows) {
      const eid = tr.entry_id as number;
      const list = tagMap.get(eid) || [];
      list.push({ id: tr.tag_id as number, name: tr.tag_name as string });
      tagMap.set(eid, list);
    }
  }

  const items: EntryListItem[] = rows.map((r) => ({
    id: r.id,
    content: r.content,
    source_type: r.source_type,
    book_title: r.book_title,
    note: r.note,
    created_at: r.created_at,
    tags: tagMap.get(r.id as number) || [],
  }));

  return { items, total };
}

export async function getEntryDetail(
  userId: number,
  entryId: number
): Promise<{
  entry: EntryListItem & { source_image_url: string | null; updated_at: Date };
  interpretation: Interpretation | null;
} | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, content, source_type, source_image_url, book_title, note, created_at, updated_at
     FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0`,
    { id: entryId, userId }
  );
  if (!rows.length) return null;

  const r = rows[0];
  const [tagRows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.name FROM entry_tags et JOIN tags t ON t.id = et.tag_id WHERE et.entry_id = :id`,
    { id: entryId }
  );
  const tags = tagRows.map((t) => ({ id: t.id as number, name: t.name as string }));

  const [interp] = await pool.query<RowDataPacket[]>(
    `SELECT id, summary, resonance, reflection_question, created_at
     FROM ai_interpretations WHERE entry_id = :id ORDER BY id DESC LIMIT 1`,
    { id: entryId }
  );

  const interpretation = interp.length
    ? {
        id: interp[0].id,
        summary: interp[0].summary,
        resonance: interp[0].resonance,
        reflection_question: interp[0].reflection_question,
        created_at: interp[0].created_at,
      }
    : null;

  return {
    entry: {
      id: r.id,
      content: r.content,
      source_type: r.source_type,
      book_title: r.book_title,
      note: r.note,
      created_at: r.created_at,
      updated_at: r.updated_at,
      source_image_url: r.source_image_url,
      tags,
    },
    interpretation,
  };
}

export async function createEntry(
  userId: number,
  body: {
    content: string;
    sourceType?: EntrySource;
    bookTitle?: string | null;
    note?: string | null;
    tags?: string[];
  }
): Promise<number> {
  const content = body.content?.trim();
  if (!content) throw new HttpError(400, "VALIDATION", "content 不能为空");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [urows] = await conn.query<RowDataPacket[]>(
      `SELECT plan, entry_count FROM users WHERE id = :id FOR UPDATE`,
      { id: userId }
    );
    if (!urows.length) throw new HttpError(404, "USER_NOT_FOUND", "用户不存在");
    const plan = urows[0].plan as string;
    const entryCount = Number(urows[0].entry_count || 0);
    if (plan === "free" && entryCount >= config.freeEntryLimit) {
      throw new HttpError(403, "ENTRY_LIMIT", `免费版最多收藏 ${config.freeEntryLimit} 条`);
    }

    const sourceType: EntrySource = body.sourceType === "ocr" ? "ocr" : "manual";

    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO entries (user_id, content, source_type, book_title, note)
       VALUES (:userId, :content, :sourceType, :bookTitle, :note)`,
      {
        userId,
        content,
        sourceType,
        bookTitle: body.bookTitle ?? null,
        note: body.note ?? null,
      }
    );
    const entryId = ins.insertId;

    await conn.query(
      `UPDATE users SET entry_count = entry_count + 1 WHERE id = :id`,
      { id: userId }
    );

    if (body.tags?.length) {
      await linkTagsByNames(conn, userId, entryId, body.tags);
    }

    await conn.commit();
    return entryId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateEntry(
  userId: number,
  entryId: number,
  body: {
    content?: string;
    bookTitle?: string | null;
    note?: string | null;
    tags?: string[];
  }
): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0 FOR UPDATE`,
      { id: entryId, userId }
    );
    if (!rows.length) {
      await conn.rollback();
      return false;
    }

    const fields: string[] = [];
    const params: Record<string, string | number | null> = { id: entryId, userId };

    if (body.content !== undefined) {
      const c = body.content.trim();
      if (!c) throw new HttpError(400, "VALIDATION", "content 不能为空");
      fields.push("content = :content");
      params.content = c;
    }
    if (body.bookTitle !== undefined) {
      fields.push("book_title = :bookTitle");
      params.bookTitle = body.bookTitle;
    }
    if (body.note !== undefined) {
      fields.push("note = :note");
      params.note = body.note;
    }

    if (fields.length) {
      await conn.query(`UPDATE entries SET ${fields.join(", ")} WHERE id = :id AND user_id = :userId`, params);
    }

    if (body.tags !== undefined) {
      await conn.query(`DELETE FROM entry_tags WHERE entry_id = :entryId`, { entryId });
      await linkTagsByNames(conn, userId, entryId, body.tags);
    }

    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function softDeleteEntry(userId: number, entryId: number): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query<ResultSetHeader>(
      `UPDATE entries SET is_deleted = 1 WHERE id = :id AND user_id = :userId AND is_deleted = 0`,
      { id: entryId, userId }
    );
    if (res.affectedRows) {
      await conn.query(
        `UPDATE users SET entry_count = GREATEST(entry_count - 1, 0) WHERE id = :id`,
        { id: userId }
      );
    }
    await conn.commit();
    return res.affectedRows > 0;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function randomEntry(userId: number): Promise<EntryListItem | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, content, source_type, book_title, note, created_at
     FROM entries WHERE user_id = :userId AND is_deleted = 0 ORDER BY RAND() LIMIT 1`,
    { userId }
  );
  if (!rows.length) return null;
  const r = rows[0];
  const detail = await getEntryDetail(userId, r.id as number);
  return detail?.entry ?? null;
}

export async function runInterpretation(
  userId: number,
  entryId: number
): Promise<Interpretation> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, content FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0`,
    { id: entryId, userId }
  );
  if (!rows.length) throw new HttpError(404, "NOT_FOUND", "收藏不存在");

  const content = rows[0].content as string;
  const provider = process.env.AI_PROVIDER || null;
  const model = process.env.AI_MODEL || null;

  let summary: string;
  let resonance: string;
  let reflection: string;

  if (process.env.OPENAI_API_KEY) {
    summary = "（已配置 OPENAI_API_KEY，可在此接入真实模型）";
    resonance = `你收藏的句子：「${content.slice(0, 80)}${content.length > 80 ? "…" : ""}」`;
    reflection = "这句话此刻最打动你的一点是什么？";
  } else {
    summary = "句子在字面之外往往还指向一种未被说清的情绪或处境。";
    resonance =
      "这类句子容易被记住，通常是因为它恰好碰上了你正在经历或渴望的主题。";
    reflection = "如果把这句话当成写给自己的便签，你会在下面补上一句什么？";
  }

  const [ins] = await pool.query<ResultSetHeader>(
    `INSERT INTO ai_interpretations
     (entry_id, user_id, summary, resonance, reflection_question, provider, model)
     VALUES (:entryId, :userId, :summary, :resonance, :reflection, :provider, :model)`,
    {
      entryId,
      userId,
      summary,
      resonance,
      reflection,
      provider,
      model,
    }
  );

  return {
    id: ins.insertId,
    summary,
    resonance,
    reflection_question: reflection,
    created_at: new Date(),
  };
}

export async function runOcr(userId: number, entryId: number): Promise<never> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0`,
    { id: entryId, userId }
  );
  if (!rows.length) throw new HttpError(404, "NOT_FOUND", "收藏不存在");

  throw new HttpError(
    503,
    "OCR_NOT_CONFIGURED",
    "OCR 服务未接入：请在服务端配置第三方 OCR 后实现本接口"
  );
}
