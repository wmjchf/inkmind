import Taro from "@tarojs/taro";
import { API_BASE } from "../config";

export async function ensureLogin(): Promise<void> {
  const existing: string | undefined = Taro.getStorageSync("accessToken");
  if (existing) return;

  const login = await Taro.login();
  if (!login.code) {
    throw new Error("微信登录失败");
  }

  const res = await Taro.request({
    url: `${API_BASE}/auth/wechat/login`,
    method: "POST",
    data: { code: login.code },
  });

  if (res.statusCode >= 400) {
    const body = res.data as { message?: string };
    throw new Error(body?.message || "登录失败");
  }

  const data = res.data as { accessToken: string };
  if (!data?.accessToken) {
    throw new Error("登录响应无效");
  }
  Taro.setStorageSync("accessToken", data.accessToken);
}
