"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeCode = exchangeCode;
const config_1 = require("../config");
const httpError_1 = require("./httpError");
async function exchangeCode(code) {
    if (config_1.config.wechat.devMock) {
        return {
            openid: `mock_${code.slice(0, 32) || "user"}`,
            unionid: null,
        };
    }
    if (!config_1.config.wechat.appId || !config_1.config.wechat.appSecret) {
        throw new httpError_1.HttpError(500, "WECHAT_NOT_CONFIGURED", "未配置 WECHAT_APPID / WECHAT_APPSECRET，或开启 WECHAT_DEV_MOCK=1 用于本地开发");
    }
    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.searchParams.set("appid", config_1.config.wechat.appId);
    url.searchParams.set("secret", config_1.config.wechat.appSecret);
    url.searchParams.set("js_code", code);
    url.searchParams.set("grant_type", "authorization_code");
    const res = await fetch(url.toString());
    const data = (await res.json());
    if (data.errcode || !data.openid) {
        throw new httpError_1.HttpError(400, "WECHAT_CODE_INVALID", data.errmsg || "微信 code 无效或已过期");
    }
    return {
        openid: data.openid,
        unionid: data.unionid ?? null,
    };
}
