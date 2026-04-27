"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockWxacodePng = mockWxacodePng;
exports.getUnlimitedWxacodePng = getUnlimitedWxacodePng;
const config_1 = require("../config");
const httpError_1 = require("../lib/httpError");
let tokenCache = null;
async function fetchAccessToken() {
    if (config_1.config.wechat.devMock) {
        throw new httpError_1.HttpError(503, "WECHAT_MOCK", "WECHAT_DEV_MOCK=1 时不请求微信接口");
    }
    if (!config_1.config.wechat.appId || !config_1.config.wechat.appSecret) {
        throw new httpError_1.HttpError(500, "WECHAT_NOT_CONFIGURED", "未配置 WECHAT_APPID / WECHAT_APPSECRET");
    }
    if (tokenCache && Date.now() < tokenCache.expiresAtMs - 120_000) {
        return tokenCache.token;
    }
    const u = new URL("https://api.weixin.qq.com/cgi-bin/token");
    u.searchParams.set("grant_type", "client_credential");
    u.searchParams.set("appid", config_1.config.wechat.appId);
    u.searchParams.set("secret", config_1.config.wechat.appSecret);
    const res = await fetch(u.toString());
    const data = (await res.json());
    console.log(data, 'data', config_1.config.wechat.appId, config_1.config.wechat.appSecret);
    if (data.errcode || !data.access_token) {
        throw new httpError_1.HttpError(502, "WECHAT_TOKEN", data.errmsg || `获取 access_token 失败 (${data.errcode})`);
    }
    const expiresIn = data.expires_in ?? 7200;
    tokenCache = {
        token: data.access_token,
        expiresAtMs: Date.now() + expiresIn * 1000,
    };
    return tokenCache.token;
}
/** 1×1 透明 PNG，用于本地 mock 占位 */
function mockWxacodePng() {
    return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
}
/**
 * 无限量小程序码（扫后进小程序指定 page，query 带 scene）
 * scene 仅数字时使用条目 id 字符串，与详情页解析一致
 */
async function getUnlimitedWxacodePng(entryId) {
    const scene = String(entryId);
    if (scene.length > 32) {
        throw new httpError_1.HttpError(400, "SCENE_TOO_LONG", "scene 超过 32 字符");
    }
    const token = await fetchAccessToken();
    const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`;
    const body = {
        scene,
        page: "pages/entry-detail/index",
        check_path: false,
        env_version: config_1.config.wechat.miniEnvVersion,
        width: 280,
    };
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500 && buf[0] === 0x7b) {
        const err = JSON.parse(buf.toString("utf8"));
        throw new httpError_1.HttpError(502, "WECHAT_WXACODE", err.errmsg || `getwxacodeunlimit 失败 (${err.errcode})`);
    }
    return buf;
}
