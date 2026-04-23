import Taro from "@tarojs/taro";
import { API_BASE } from "../config";

export async function apiRequest<T>(opts: {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: Record<string, unknown>;
  /** 默认带 token；登录接口传 false */
  auth?: boolean;
}): Promise<T> {
  const useAuth = opts.auth !== false;
  const token: string | undefined = useAuth ? Taro.getStorageSync("accessToken") : undefined;
  const res = await Taro.request({
    url: `${API_BASE}${opts.url}`,
    method: opts.method || "GET",
    data: opts.data,
    header: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.statusCode === 401) {
    Taro.removeStorageSync("accessToken");
  }
  if (res.statusCode >= 400) {
    const body = res.data as { message?: string; code?: string };
    const err = new Error(body?.message || `请求失败（${res.statusCode}）`);
    (err as Error & { code?: string }).code = body?.code;
    throw err;
  }
  return res.data as T;
}
