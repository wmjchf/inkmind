"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFeedback = createFeedback;
const db_1 = require("../db");
const httpError_1 = require("../lib/httpError");
async function createFeedback(userId, body) {
    const content = body.content.trim();
    if (!content)
        throw new httpError_1.HttpError(400, "VALIDATION", "反馈内容不能为空");
    if (content.length > 2000)
        throw new httpError_1.HttpError(400, "VALIDATION", "反馈内容最多 2000 字");
    let contact = null;
    if (body.contact != null && String(body.contact).trim()) {
        const c = String(body.contact).trim().slice(0, 120);
        contact = c.length ? c : null;
    }
    const [ins] = await db_1.pool.query(`INSERT INTO feedbacks (user_id, content, contact) VALUES (:userId, :content, :contact)`, { userId, content, contact });
    return ins.insertId;
}
