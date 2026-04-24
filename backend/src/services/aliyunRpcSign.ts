import crypto from "crypto";

/** 阿里云 RPC 风格 URL 编码（与官方 OCR 签名文档一致） */
export function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}

/** UTC 时间戳，格式 yyyy-MM-ddTHH:mm:ssZ（无毫秒，避免部分网关校验差异） */
export function aliyunTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * 计算 RPC 签名（不含 Signature 键本身）。
 * @param method 与真实 HTTP 请求一致，OCR 传图片 body 时用 POST
 */
export function signAliyunRpc(
  method: "GET" | "POST",
  params: Record<string, string>,
  accessKeySecret: string
): string {
  const keys = Object.keys(params).sort();
  const canonical = keys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
  const stringToSign = `${method}&${percentEncode("/")}&${percentEncode(canonical)}`;
  return crypto.createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
}
