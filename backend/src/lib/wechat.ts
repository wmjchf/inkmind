import { config } from "../config";
import { HttpError } from "./httpError";

type JsCode2Session = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

export async function exchangeCode(
  code: string
): Promise<{ openid: string; unionid: string | null }> {
  if (config.wechat.devMock) {
    return {
      openid: `mock_${code.slice(0, 32) || "user"}`,
      unionid: null,
    };
  }

  if (!config.wechat.appId || !config.wechat.appSecret) {
    throw new HttpError(
      500,
      "WECHAT_NOT_CONFIGURED",
      "未配置 WECHAT_APPID / WECHAT_APPSECRET，或开启 WECHAT_DEV_MOCK=1 用于本地开发"
    );
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", config.wechat.appId);
  url.searchParams.set("secret", config.wechat.appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url.toString());
  const data = (await res.json()) as JsCode2Session;

  if (data.errcode || !data.openid) {
    throw new HttpError(
      400,
      "WECHAT_CODE_INVALID",
      data.errmsg || "微信 code 无效或已过期"
    );
  }

  return {
    openid: data.openid,
    unionid: data.unionid ?? null,
  };
}
