import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "../db";
import { config } from "../config";
import { HttpError } from "../lib/httpError";
import { resolveChatCompletionConfig } from "../lib/aiChatConfig";
import { interpretContentWithModel } from "./aiInterpret";
import { suggestTagsFromContent } from "./aiTagSuggest";

export type EntrySource = "manual" | "ocr";

export type EntryVisibility = "private" | "public" | "unlisted";

export type EntryListItem = {
  id: number;
  content: string;
  source_type: EntrySource;
  book_title: string | null;
  note: string | null;
  created_at: Date;
  visibility: EntryVisibility;
  tags: { id: number; name: string }[];
};

/** 广场动态列表（仅 visibility=public） */
export type PlazaFeedItem = {
  id: number;
  content: string;
  book_title: string | null;
  created_at: Date;
  author: { nickname: string | null; avatarUrl: string | null };
  likeCount: number;
  saveCount: number;
};

export type Interpretation = {
  id: number;
  summary: string;
  resonance: string;
  reflection_question: string;
  created_at: Date;
};

type TagCreator = "user" | "ai" | "system";

async function linkTagsByNames(
  conn: import("mysql2/promise").PoolConnection,
  userId: number,
  entryId: number,
  tagNames: string[],
  createdBy: TagCreator = "user"
): Promise<void> {
  const names = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  for (const name of names) {
    await conn.query(
      `INSERT INTO tags (user_id, name, created_by) VALUES (:userId, :name, :createdBy)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      { userId, name, createdBy }
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

export async function listDistinctBookTitles(userId: number): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT e.book_title AS t
     FROM entries e
     WHERE e.user_id = :userId AND e.is_deleted = 0
       AND e.book_title IS NOT NULL AND TRIM(e.book_title) <> ''
     ORDER BY e.book_title ASC`,
    { userId }
  );
  return rows.map((r) => String(r.t));
}

/** 首页书架：每本书一条，取该书下最新创建的一条摘录 */
export type BookShelfListItem = {
  book_title: string;
  latest_entry: {
    id: number;
    content: string;
    created_at: Date;
  };
};

export async function listBookShelfWithLatestEntry(userId: number): Promise<BookShelfListItem[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT x.id AS id, x.content AS content, x.created_at AS created_at, x.book_title AS book_title
     FROM (
       SELECT e.id, e.content, e.created_at, e.book_title,
              ROW_NUMBER() OVER (
                PARTITION BY e.book_title ORDER BY e.created_at DESC, e.id DESC
              ) AS rn
       FROM entries e
       WHERE e.user_id = :userId AND e.is_deleted = 0
         AND e.book_title IS NOT NULL AND TRIM(e.book_title) <> ''
     ) x
     WHERE x.rn = 1
     ORDER BY x.created_at DESC`,
    { userId }
  );
  return rows.map((r) => ({
    book_title: String(r.book_title),
    latest_entry: {
      id: Number(r.id),
      content: String(r.content),
      created_at: r.created_at as Date,
    },
  }));
}

export async function listEntries(
  userId: number,
  opts: { page: number; pageSize: number; q?: string; tagId?: number; bookTitle?: string }
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
  const bookTrim = opts.bookTitle?.trim();
  if (bookTrim) {
    where += " AND e.book_title = :bookTitle";
    params.bookTitle = bookTrim;
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM entries e WHERE ${where}`,
    params
  );
  const total = Number(countRows[0]?.c || 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.content, e.source_type, e.book_title, e.note, e.created_at, e.visibility
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
    visibility: r.visibility as EntryVisibility,
    tags: tagMap.get(r.id as number) || [],
  }));

  return { items, total };
}

export async function listPlazaFeed(opts: {
  page: number;
  pageSize: number;
  /** 模糊匹配正文或书名 */
  q?: string;
}): Promise<{ items: PlazaFeedItem[]; total: number }> {
  const offset = (opts.page - 1) * opts.pageSize;
  const qTrim = opts.q?.trim().slice(0, 200);
  let whereExtra = "";
  const params: Record<string, string | number> = {
    limit: opts.pageSize,
    offset,
  };
  if (qTrim) {
    whereExtra = " AND (e.content LIKE :likeQ OR e.book_title LIKE :likeQ)";
    params.likeQ = `%${qTrim}%`;
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM entries e
     WHERE e.is_deleted = 0 AND e.visibility = 'public'${whereExtra}`,
    params
  );
  const total = Number(countRows[0]?.c || 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.content, e.book_title, e.created_at, e.like_count,
            u.nickname AS author_nickname, u.avatar_url AS author_avatar_url,
            (SELECT COUNT(*) FROM entry_saves es WHERE es.entry_id = e.id) AS save_count
     FROM entries e
     INNER JOIN users u ON u.id = e.user_id
     WHERE e.is_deleted = 0 AND e.visibility = 'public'${whereExtra}
     ORDER BY COALESCE(e.published_at, e.created_at) DESC, e.id DESC
     LIMIT :limit OFFSET :offset`,
    params
  );

  const items: PlazaFeedItem[] = rows.map((r) => ({
    id: Number(r.id),
    content: String(r.content),
    book_title: r.book_title != null ? String(r.book_title) : null,
    created_at: r.created_at as Date,
    author: {
      nickname: r.author_nickname != null ? String(r.author_nickname) : null,
      avatarUrl: r.author_avatar_url != null ? String(r.author_avatar_url) : null,
    },
    likeCount: Number(r.like_count ?? 0),
    saveCount: Number(r.save_count ?? 0),
  }));

  return { items, total };
}

export type EntryInteraction = {
  likeCount: number;
  saveCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
};

export async function getEntryDetail(
  userId: number,
  entryId: number
): Promise<{
  entry: EntryListItem & { source_image_url: string | null; updated_at: Date };
  interpretation: Interpretation | null;
  /** 当前登录用户是否为该条摘录的作者（他人通过分享进入时为 false） */
  is_owner: boolean;
  /** 仅浏览他人公开摘录时有：点赞/收藏数与个人点赞、收藏状态 */
  interaction?: EntryInteraction;
  /** 作者查看自己的公开摘录时：广场侧点赞数与被大家收藏的次数 */
  publicStats?: { likeCount: number; saveCount: number };
} | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.user_id, e.content, e.source_type, e.source_image_url, e.book_title, e.note, e.created_at, e.updated_at, e.visibility, e.like_count,
            (SELECT COUNT(*) FROM entry_saves es WHERE es.entry_id = e.id) AS save_count
     FROM entries e WHERE e.id = :id AND e.is_deleted = 0`,
    { id: entryId }
  );
  if (!rows.length) return null;

  const r = rows[0];
  const is_owner = Number(r.user_id) === userId;
  const visibility = r.visibility as EntryVisibility;
  if (!is_owner && visibility !== "public") {
    return null;
  }
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

  const likeCount = Number(r.like_count ?? 0);
  const saveCount = Number(r.save_count ?? 0);

  let interaction: EntryInteraction | undefined;
  if (!is_owner && visibility === "public") {
    const [lkRows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM entry_likes WHERE user_id = :userId AND entry_id = :entryId LIMIT 1`,
      { userId, entryId }
    );
    const [svRows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM entry_saves WHERE user_id = :userId AND entry_id = :entryId LIMIT 1`,
      { userId, entryId }
    );
    interaction = {
      likeCount,
      saveCount,
      likedByMe: lkRows.length > 0,
      savedByMe: svRows.length > 0,
    };
  }

  const publicStats =
    is_owner && visibility === "public" ? { likeCount, saveCount } : undefined;

  return {
    entry: {
      id: r.id,
      content: r.content,
      source_type: r.source_type,
      book_title: r.book_title,
      note: r.note,
      created_at: r.created_at,
      updated_at: r.updated_at,
      visibility,
      source_image_url: r.source_image_url,
      tags,
    },
    interpretation,
    is_owner,
    interaction,
    publicStats,
  };
}

/** 点赞/取消赞（仅公开摘录，且不能赞自己的） */
export async function toggleEntryLike(
  actorUserId: number,
  entryId: number
): Promise<{ liked: boolean; likeCount: number }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [erows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id, visibility, like_count FROM entries WHERE id = :id AND is_deleted = 0 FOR UPDATE`,
      { id: entryId }
    );
    if (!erows.length) throw new HttpError(404, "NOT_FOUND", "收藏不存在");
    const ownerId = Number(erows[0].user_id);
    const vis = erows[0].visibility as EntryVisibility;
    if (vis !== "public") {
      throw new HttpError(403, "FORBIDDEN", "仅公开摘录可点赞");
    }
    if (ownerId === actorUserId) {
      throw new HttpError(400, "BAD_REQUEST", "不能给自己的摘录点赞");
    }

    const [existing] = await conn.query<RowDataPacket[]>(
      `SELECT 1 FROM entry_likes WHERE user_id = :userId AND entry_id = :entryId`,
      { userId: actorUserId, entryId }
    );
    const hadLike = existing.length > 0;

    if (hadLike) {
      await conn.query(`DELETE FROM entry_likes WHERE user_id = :userId AND entry_id = :entryId`, {
        userId: actorUserId,
        entryId,
      });
      await conn.query(
        `UPDATE entries SET like_count = GREATEST(like_count - 1, 0) WHERE id = :id`,
        { id: entryId }
      );
    } else {
      await conn.query(
        `INSERT INTO entry_likes (user_id, entry_id) VALUES (:userId, :entryId)`,
        { userId: actorUserId, entryId }
      );
      await conn.query(`UPDATE entries SET like_count = like_count + 1 WHERE id = :id`, {
        id: entryId,
      });
    }

    const [countRows] = await conn.query<RowDataPacket[]>(
      `SELECT like_count FROM entries WHERE id = :id`,
      { id: entryId }
    );
    const likeCount = Number(countRows[0]?.like_count ?? 0);

    await conn.commit();
    return { liked: !hadLike, likeCount };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** 收藏/取消收藏他人公开摘录（书签） */
export async function toggleEntrySave(
  actorUserId: number,
  entryId: number
): Promise<{ saved: boolean; saveCount: number }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [erows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id, visibility FROM entries WHERE id = :id AND is_deleted = 0 FOR UPDATE`,
      { id: entryId }
    );
    if (!erows.length) throw new HttpError(404, "NOT_FOUND", "收藏不存在");
    const ownerId = Number(erows[0].user_id);
    const vis = erows[0].visibility as EntryVisibility;
    if (vis !== "public") {
      throw new HttpError(403, "FORBIDDEN", "仅公开摘录可收藏");
    }
    if (ownerId === actorUserId) {
      throw new HttpError(400, "BAD_REQUEST", "不能收藏自己的摘录");
    }

    const [existing] = await conn.query<RowDataPacket[]>(
      `SELECT 1 FROM entry_saves WHERE user_id = :userId AND entry_id = :entryId`,
      { userId: actorUserId, entryId }
    );
    const hadSave = existing.length > 0;

    if (hadSave) {
      await conn.query(`DELETE FROM entry_saves WHERE user_id = :userId AND entry_id = :entryId`, {
        userId: actorUserId,
        entryId,
      });
    } else {
      await conn.query(
        `INSERT INTO entry_saves (user_id, entry_id) VALUES (:userId, :entryId)`,
        { userId: actorUserId, entryId }
      );
    }

    const [cntRows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM entry_saves WHERE entry_id = :entryId`,
      { entryId }
    );
    const saveCount = Number(cntRows[0]?.c ?? 0);

    await conn.commit();
    return { saved: !hadSave, saveCount };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
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

  const bookTitleTrim = (body.bookTitle ?? "").trim();
  if (!bookTitleTrim) throw new HttpError(400, "VALIDATION", "书名不能为空");

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
        bookTitle: bookTitleTrim,
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
    visibility?: EntryVisibility;
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
      const bt = body.bookTitle === null ? "" : String(body.bookTitle).trim();
      if (!bt) throw new HttpError(400, "VALIDATION", "书名不能为空");
      fields.push("book_title = :bookTitle");
      params.bookTitle = bt;
    }
    if (body.note !== undefined) {
      const raw = body.note === null ? "" : String(body.note);
      const n = raw.trim().slice(0, 500);
      fields.push("note = :note");
      params.note = n.length ? n : null;
    }
    if (body.visibility !== undefined) {
      const v = body.visibility;
      if (v !== "private" && v !== "public" && v !== "unlisted") {
        throw new HttpError(400, "VALIDATION", "visibility 无效");
      }
      fields.push("visibility = :visibility");
      params.visibility = v;
      if (v === "public") {
        fields.push("published_at = COALESCE(published_at, CURRENT_TIMESTAMP(3))");
      }
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

/** AI 打标签与手动标签的协同策略 */
export type AiTagStrategy = "merge" | "append_if_empty" | "replace_ai_only";

/**
 * AI 生成标签并写入 `tags`（created_by=ai）+ `entry_tags`。
 *
 * - **merge**（默认）：保留用户已有标签；只补充模型输出里**尚未出现在该条收藏上**的标签（同名去重，不区分谁创建）。
 * - **append_if_empty**：仅当该条**没有任何标签**时才打 AI 标签；已有手动标签则跳过。
 * - **replace_ai_only**：删掉本条上所有「仅由 AI 建链」的标签关联后，再写入新一轮 AI 标签；**不动用户手动标签**。
 */
export async function applyAiTags(
  userId: number,
  entryId: number,
  strategy: AiTagStrategy = "merge"
): Promise<{ added: string[]; skipped: boolean; reason?: string }> {
  const [erows] = await pool.query<RowDataPacket[]>(
    `SELECT id, content, book_title FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0`,
    { id: entryId, userId }
  );
  if (!erows.length) throw new HttpError(404, "NOT_FOUND", "收藏不存在");

  const content = erows[0].content as string;
  const bookTitle = (erows[0].book_title as string | null) ?? null;

  const [trows] = await pool.query<RowDataPacket[]>(
    `SELECT t.name
     FROM entry_tags et
     JOIN tags t ON t.id = et.tag_id
     WHERE et.entry_id = :entryId AND t.user_id = :userId`,
    { entryId, userId }
  );
  const namesOnEntry = trows.map((r) => r.name as string);

  if (strategy === "append_if_empty" && namesOnEntry.length > 0) {
    return { added: [], skipped: true, reason: "ENTRY_HAS_TAGS" };
  }

  const suggestions = await suggestTagsFromContent(content, namesOnEntry, bookTitle);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (strategy === "replace_ai_only") {
      await conn.query(
        `DELETE et FROM entry_tags et
         INNER JOIN tags t ON t.id = et.tag_id
         WHERE et.entry_id = :entryId AND t.user_id = :userId AND t.created_by = 'ai'`,
        { entryId, userId }
      );
    }

    const [afterRows] = await conn.query<RowDataPacket[]>(
      `SELECT t.name
       FROM entry_tags et
       JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id = :entryId AND t.user_id = :userId`,
      { entryId, userId }
    );
    const currentLower = new Set(afterRows.map((r) => (r.name as string).toLowerCase()));

    const toLink = suggestions.filter((s) => !currentLower.has(s.trim().toLowerCase()));

    if (toLink.length) {
      await linkTagsByNames(conn, userId, entryId, toLink, "ai");
    }

    await conn.commit();
    return { added: toLink, skipped: false };
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
    `SELECT id, content, book_title FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0`,
    { id: entryId, userId }
  );
  if (!rows.length) throw new HttpError(404, "NOT_FOUND", "收藏不存在");

  const content = rows[0].content as string;
  const bookTitle = (rows[0].book_title as string | null) ?? null;

  let summary: string;
  let resonance: string;
  let reflection: string;
  let provider: string | null = process.env.AI_PROVIDER?.trim() || null;
  let model: string | null = null;

  const chat = resolveChatCompletionConfig();
  if (chat) {
    const out = await interpretContentWithModel(content, chat, bookTitle);
    summary = out.text;
    resonance = "";
    reflection = "";
    provider = out.provider;
    model = out.model;
  } else {
    summary =
      "从摘录本身能确定的信息有限。可依字面先概括其命题或判断，再区分：哪些是文内明确写出的，哪些需要结合全书或语境才能进一步讨论。未配置大模型时此为占位说明。";
    resonance = "";
    reflection = "";
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
