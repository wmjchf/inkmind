"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateByWechat = findOrCreateByWechat;
exports.getUserById = getUserById;
const db_1 = require("../db");
async function findOrCreateByWechat(openid, unionid) {
    const [rows] = await db_1.pool.query(`SELECT id, wechat_openid, wechat_unionid, nickname, avatar_url, plan, entry_count, ocr_count_month
     FROM users WHERE wechat_openid = :openid LIMIT 1`, { openid });
    if (rows.length) {
        const u = rows[0];
        if (unionid && !u.wechat_unionid) {
            await db_1.pool.query(`UPDATE users SET wechat_unionid = :unionid WHERE id = :id`, {
                unionid,
                id: u.id,
            });
            u.wechat_unionid = unionid;
        }
        return u;
    }
    const [result] = await db_1.pool.query(`INSERT INTO users (wechat_openid, wechat_unionid) VALUES (:openid, :unionid)`, { openid, unionid });
    const id = result.insertId;
    const [created] = await db_1.pool.query(`SELECT id, wechat_openid, wechat_unionid, nickname, avatar_url, plan, entry_count, ocr_count_month
     FROM users WHERE id = :id`, { id });
    return created[0];
}
async function getUserById(id) {
    const [rows] = await db_1.pool.query(`SELECT id, wechat_openid, wechat_unionid, nickname, avatar_url, plan, entry_count, ocr_count_month
     FROM users WHERE id = :id LIMIT 1`, { id });
    return rows.length ? rows[0] : null;
}
