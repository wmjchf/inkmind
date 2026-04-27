"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDistinctBookTitles = listDistinctBookTitles;
exports.listEntries = listEntries;
exports.getEntryDetail = getEntryDetail;
exports.createEntry = createEntry;
exports.updateEntry = updateEntry;
exports.softDeleteEntry = softDeleteEntry;
exports.applyAiTags = applyAiTags;
exports.randomEntry = randomEntry;
exports.runInterpretation = runInterpretation;
exports.runOcr = runOcr;
const db_1 = require("../db");
const config_1 = require("../config");
const httpError_1 = require("../lib/httpError");
const aiChatConfig_1 = require("../lib/aiChatConfig");
const aiInterpret_1 = require("./aiInterpret");
const aiTagSuggest_1 = require("./aiTagSuggest");
async function linkTagsByNames(conn, userId, entryId, tagNames, createdBy = "user") {
    const names = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
    for (const name of names) {
        await conn.query(`INSERT INTO tags (user_id, name, created_by) VALUES (:userId, :name, :createdBy)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`, { userId, name, createdBy });
        const [rows] = await conn.query("SELECT LAST_INSERT_ID() AS id");
        const tagId = Number(rows[0]?.id);
        if (!Number.isFinite(tagId) || tagId <= 0)
            continue;
        await conn.query(`INSERT IGNORE INTO entry_tags (entry_id, tag_id) VALUES (:entryId, :tagId)`, { entryId, tagId });
    }
}
async function listDistinctBookTitles(userId) {
    const [rows] = await db_1.pool.query(`SELECT DISTINCT e.book_title AS t
     FROM entries e
     WHERE e.user_id = :userId AND e.is_deleted = 0
       AND e.book_title IS NOT NULL AND TRIM(e.book_title) <> ''
     ORDER BY e.book_title ASC`, { userId });
    return rows.map((r) => String(r.t));
}
async function listEntries(userId, opts) {
    const offset = (opts.page - 1) * opts.pageSize;
    const params = { userId, offset, limit: opts.pageSize };
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
    const [countRows] = await db_1.pool.query(`SELECT COUNT(*) AS c FROM entries e WHERE ${where}`, params);
    const total = Number(countRows[0]?.c || 0);
    const [rows] = await db_1.pool.query(`SELECT e.id, e.content, e.source_type, e.book_title, e.note, e.created_at
     FROM entries e
     WHERE ${where}
     ORDER BY e.created_at DESC
     LIMIT :limit OFFSET :offset`, params);
    const ids = rows.map((r) => r.id);
    const tagMap = new Map();
    if (ids.length) {
        const [tagRows] = await db_1.pool.query(`SELECT et.entry_id AS entry_id, t.id AS tag_id, t.name AS tag_name
       FROM entry_tags et
       JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id IN (${ids.map(() => "?").join(",")})`, ids);
        for (const tr of tagRows) {
            const eid = tr.entry_id;
            const list = tagMap.get(eid) || [];
            list.push({ id: tr.tag_id, name: tr.tag_name });
            tagMap.set(eid, list);
        }
    }
    const items = rows.map((r) => ({
        id: r.id,
        content: r.content,
        source_type: r.source_type,
        book_title: r.book_title,
        note: r.note,
        created_at: r.created_at,
        tags: tagMap.get(r.id) || [],
    }));
    return { items, total };
}
async function getEntryDetail(userId, entryId) {
    const [rows] = await db_1.pool.query(`SELECT id, user_id, content, source_type, source_image_url, book_title, note, created_at, updated_at
     FROM entries WHERE id = :id AND is_deleted = 0`, { id: entryId });
    if (!rows.length)
        return null;
    const r = rows[0];
    const is_owner = Number(r.user_id) === userId;
    const [tagRows] = await db_1.pool.query(`SELECT t.id, t.name FROM entry_tags et JOIN tags t ON t.id = et.tag_id WHERE et.entry_id = :id`, { id: entryId });
    const tags = tagRows.map((t) => ({ id: t.id, name: t.name }));
    const [interp] = await db_1.pool.query(`SELECT id, summary, resonance, reflection_question, created_at
     FROM ai_interpretations WHERE entry_id = :id ORDER BY id DESC LIMIT 1`, { id: entryId });
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
        is_owner,
    };
}
async function createEntry(userId, body) {
    const content = body.content?.trim();
    if (!content)
        throw new httpError_1.HttpError(400, "VALIDATION", "content 不能为空");
    const bookTitleTrim = (body.bookTitle ?? "").trim();
    if (!bookTitleTrim)
        throw new httpError_1.HttpError(400, "VALIDATION", "书名不能为空");
    const conn = await db_1.pool.getConnection();
    try {
        await conn.beginTransaction();
        const [urows] = await conn.query(`SELECT plan, entry_count FROM users WHERE id = :id FOR UPDATE`, { id: userId });
        if (!urows.length)
            throw new httpError_1.HttpError(404, "USER_NOT_FOUND", "用户不存在");
        const plan = urows[0].plan;
        const entryCount = Number(urows[0].entry_count || 0);
        if (plan === "free" && entryCount >= config_1.config.freeEntryLimit) {
            throw new httpError_1.HttpError(403, "ENTRY_LIMIT", `免费版最多收藏 ${config_1.config.freeEntryLimit} 条`);
        }
        const sourceType = body.sourceType === "ocr" ? "ocr" : "manual";
        const [ins] = await conn.query(`INSERT INTO entries (user_id, content, source_type, book_title, note)
       VALUES (:userId, :content, :sourceType, :bookTitle, :note)`, {
            userId,
            content,
            sourceType,
            bookTitle: bookTitleTrim,
            note: body.note ?? null,
        });
        const entryId = ins.insertId;
        await conn.query(`UPDATE users SET entry_count = entry_count + 1 WHERE id = :id`, { id: userId });
        if (body.tags?.length) {
            await linkTagsByNames(conn, userId, entryId, body.tags);
        }
        await conn.commit();
        return entryId;
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
}
async function updateEntry(userId, entryId, body) {
    const conn = await db_1.pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(`SELECT id FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0 FOR UPDATE`, { id: entryId, userId });
        if (!rows.length) {
            await conn.rollback();
            return false;
        }
        const fields = [];
        const params = { id: entryId, userId };
        if (body.content !== undefined) {
            const c = body.content.trim();
            if (!c)
                throw new httpError_1.HttpError(400, "VALIDATION", "content 不能为空");
            fields.push("content = :content");
            params.content = c;
        }
        if (body.bookTitle !== undefined) {
            const bt = body.bookTitle === null ? "" : String(body.bookTitle).trim();
            if (!bt)
                throw new httpError_1.HttpError(400, "VALIDATION", "书名不能为空");
            fields.push("book_title = :bookTitle");
            params.bookTitle = bt;
        }
        if (body.note !== undefined) {
            const raw = body.note === null ? "" : String(body.note);
            const n = raw.trim().slice(0, 500);
            fields.push("note = :note");
            params.note = n.length ? n : null;
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
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
}
async function softDeleteEntry(userId, entryId) {
    const conn = await db_1.pool.getConnection();
    try {
        await conn.beginTransaction();
        const [res] = await conn.query(`UPDATE entries SET is_deleted = 1 WHERE id = :id AND user_id = :userId AND is_deleted = 0`, { id: entryId, userId });
        if (res.affectedRows) {
            await conn.query(`UPDATE users SET entry_count = GREATEST(entry_count - 1, 0) WHERE id = :id`, { id: userId });
        }
        await conn.commit();
        return res.affectedRows > 0;
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
}
/**
 * AI 生成标签并写入 `tags`（created_by=ai）+ `entry_tags`。
 *
 * - **merge**（默认）：保留用户已有标签；只补充模型输出里**尚未出现在该条收藏上**的标签（同名去重，不区分谁创建）。
 * - **append_if_empty**：仅当该条**没有任何标签**时才打 AI 标签；已有手动标签则跳过。
 * - **replace_ai_only**：删掉本条上所有「仅由 AI 建链」的标签关联后，再写入新一轮 AI 标签；**不动用户手动标签**。
 */
async function applyAiTags(userId, entryId, strategy = "merge") {
    const [erows] = await db_1.pool.query(`SELECT id, content, book_title FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0`, { id: entryId, userId });
    if (!erows.length)
        throw new httpError_1.HttpError(404, "NOT_FOUND", "收藏不存在");
    const content = erows[0].content;
    const bookTitle = erows[0].book_title ?? null;
    const [trows] = await db_1.pool.query(`SELECT t.name
     FROM entry_tags et
     JOIN tags t ON t.id = et.tag_id
     WHERE et.entry_id = :entryId AND t.user_id = :userId`, { entryId, userId });
    const namesOnEntry = trows.map((r) => r.name);
    if (strategy === "append_if_empty" && namesOnEntry.length > 0) {
        return { added: [], skipped: true, reason: "ENTRY_HAS_TAGS" };
    }
    const suggestions = await (0, aiTagSuggest_1.suggestTagsFromContent)(content, namesOnEntry, bookTitle);
    const conn = await db_1.pool.getConnection();
    try {
        await conn.beginTransaction();
        if (strategy === "replace_ai_only") {
            await conn.query(`DELETE et FROM entry_tags et
         INNER JOIN tags t ON t.id = et.tag_id
         WHERE et.entry_id = :entryId AND t.user_id = :userId AND t.created_by = 'ai'`, { entryId, userId });
        }
        const [afterRows] = await conn.query(`SELECT t.name
       FROM entry_tags et
       JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id = :entryId AND t.user_id = :userId`, { entryId, userId });
        const currentLower = new Set(afterRows.map((r) => r.name.toLowerCase()));
        const toLink = suggestions.filter((s) => !currentLower.has(s.trim().toLowerCase()));
        if (toLink.length) {
            await linkTagsByNames(conn, userId, entryId, toLink, "ai");
        }
        await conn.commit();
        return { added: toLink, skipped: false };
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
}
async function randomEntry(userId) {
    const [rows] = await db_1.pool.query(`SELECT id, content, source_type, book_title, note, created_at
     FROM entries WHERE user_id = :userId AND is_deleted = 0 ORDER BY RAND() LIMIT 1`, { userId });
    if (!rows.length)
        return null;
    const r = rows[0];
    const detail = await getEntryDetail(userId, r.id);
    return detail?.entry ?? null;
}
async function runInterpretation(userId, entryId) {
    const [rows] = await db_1.pool.query(`SELECT id, content, book_title FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0`, { id: entryId, userId });
    if (!rows.length)
        throw new httpError_1.HttpError(404, "NOT_FOUND", "收藏不存在");
    const content = rows[0].content;
    const bookTitle = rows[0].book_title ?? null;
    let summary;
    let resonance;
    let reflection;
    let provider = process.env.AI_PROVIDER?.trim() || null;
    let model = null;
    const chat = (0, aiChatConfig_1.resolveChatCompletionConfig)();
    if (chat) {
        const out = await (0, aiInterpret_1.interpretContentWithModel)(content, chat, bookTitle);
        summary = out.summary;
        resonance = out.resonance;
        reflection = out.reflection_question;
        provider = out.provider;
        model = out.model;
    }
    else {
        summary = "句子在字面之外往往还指向一种未被说清的情绪或处境。";
        resonance =
            "这类句子容易被记住，通常是因为它恰好碰上了你正在经历或渴望的主题。";
        reflection = "如果把这句话当成写给自己的便签，你会在下面补上一句什么？";
    }
    const [ins] = await db_1.pool.query(`INSERT INTO ai_interpretations
     (entry_id, user_id, summary, resonance, reflection_question, provider, model)
     VALUES (:entryId, :userId, :summary, :resonance, :reflection, :provider, :model)`, {
        entryId,
        userId,
        summary,
        resonance,
        reflection,
        provider,
        model,
    });
    return {
        id: ins.insertId,
        summary,
        resonance,
        reflection_question: reflection,
        created_at: new Date(),
    };
}
async function runOcr(userId, entryId) {
    const [rows] = await db_1.pool.query(`SELECT id FROM entries WHERE id = :id AND user_id = :userId AND is_deleted = 0`, { id: entryId, userId });
    if (!rows.length)
        throw new httpError_1.HttpError(404, "NOT_FOUND", "收藏不存在");
    throw new httpError_1.HttpError(503, "OCR_NOT_CONFIGURED", "OCR 服务未接入：请在服务端配置第三方 OCR 后实现本接口");
}
