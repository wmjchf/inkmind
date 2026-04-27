import { config } from "../config";
import { HttpError } from "../lib/httpError";

type TokenRes = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

let tokenCache: { token: string; expiresAtMs: number } | null = null;

async function fetchAccessToken(): Promise<string> {
  if (config.wechat.devMock) {
    throw new HttpError(503, "WECHAT_MOCK", "WECHAT_DEV_MOCK=1 时不请求微信接口");
  }
  if (!config.wechat.appId || !config.wechat.appSecret) {
    throw new HttpError(500, "WECHAT_NOT_CONFIGURED", "未配置 WECHAT_APPID / WECHAT_APPSECRET");
  }
  if (tokenCache && Date.now() < tokenCache.expiresAtMs - 120_000) {
    return tokenCache.token;
  }
  const u = new URL("https://api.weixin.qq.com/cgi-bin/token");
  u.searchParams.set("grant_type", "client_credential");
  u.searchParams.set("appid", config.wechat.appId);
  u.searchParams.set("secret", config.wechat.appSecret);
  const res = await fetch(u.toString());
  const data = (await res.json()) as TokenRes;
  console.log(data,'data',config.wechat.appId,config.wechat.appSecret)
  if (data.errcode || !data.access_token) {
    throw new HttpError(502, "WECHAT_TOKEN", data.errmsg || `获取 access_token 失败 (${data.errcode})`);
  }
  const expiresIn = data.expires_in ?? 7200;
  tokenCache = {
    token: data.access_token,
    expiresAtMs: Date.now() + expiresIn * 1000,
  };
  return tokenCache.token;
}

/** 1×1 透明 PNG，用于本地 mock 占位 */
export function mockWxacodePng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
}

/**
 * 无限量小程序码（扫后进小程序指定 page，query 带 scene）
 * scene 仅数字时使用条目 id 字符串，与详情页解析一致
 */
export async function getUnlimitedWxacodePng(entryId: number): Promise<Buffer> {
  const scene = String(entryId);
  if (scene.length > 32) {
    throw new HttpError(400, "SCENE_TOO_LONG", "scene 超过 32 字符");
  }
  const token = await fetchAccessToken();
  const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`;
  const body = {
    scene,
    page: "pages/entry-detail/index",
    check_path: false,
    env_version: config.wechat.miniEnvVersion,
    width: 280,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500 && buf[0] === 0x7b) {
    const err = JSON.parse(buf.toString("utf8")) as { errcode?: number; errmsg?: string };
    throw new HttpError(
      502,
      "WECHAT_WXACODE",
      err.errmsg || `getwxacodeunlimit 失败 (${err.errcode})`
    );
  }
  return buf;
}
