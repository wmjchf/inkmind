"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.percentEncode = percentEncode;
exports.aliyunTimestamp = aliyunTimestamp;
exports.signAliyunRpc = signAliyunRpc;
const crypto_1 = __importDefault(require("crypto"));
/** 阿里云 RPC 风格 URL 编码（与官方 OCR 签名文档一致） */
function percentEncode(s) {
    return encodeURIComponent(s).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}
/** UTC 时间戳，格式 yyyy-MM-ddTHH:mm:ssZ（无毫秒，避免部分网关校验差异） */
function aliyunTimestamp() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
/**
 * 计算 RPC 签名（不含 Signature 键本身）。
 * @param method 与真实 HTTP 请求一致，OCR 传图片 body 时用 POST
 */
function signAliyunRpc(method, params, accessKeySecret) {
    const keys = Object.keys(params).sort();
    const canonical = keys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
    const stringToSign = `${method}&${percentEncode("/")}&${percentEncode(canonical)}`;
    return crypto_1.default.createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
}
