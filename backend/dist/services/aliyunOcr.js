"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recognizeAdvancedFromImageBuffer = recognizeAdvancedFromImageBuffer;
const crypto_1 = __importDefault(require("crypto"));
const aliyunRpcSign_1 = require("./aliyunRpcSign");
const httpError_1 = require("../lib/httpError");
function buildQueryString(params) {
    return Object.keys(params)
        .sort()
        .map((k) => `${(0, aliyunRpcSign_1.percentEncode)(k)}=${(0, aliyunRpcSign_1.percentEncode)(params[k])}`)
        .join("&");
}
/**
 * 阿里云文字识别「全文识别高精版」RecognizeAdvanced（OpenAPI 2021-07-07）。
 * 无官方 Node SDK 时：按文档做 RPC 签名 + POST body 传原图二进制。
 *
 * 文档：签名 https://help.aliyun.com/zh/ocr/developer-reference/signature-method
 *       接口 https://help.aliyun.com/zh/ocr/developer-reference/api-ocr-api-2021-07-07-recognizeadvanced
 */
async function recognizeAdvancedFromImageBuffer(imageBuffer, opts) {
    const endpoint = opts.endpoint || "ocr-api.cn-hangzhou.aliyuncs.com";
    const baseParams = {
        Action: "RecognizeAdvanced",
        Version: "2021-07-07",
        Format: "JSON",
        AccessKeyId: opts.accessKeyId,
        SignatureNonce: crypto_1.default.randomUUID(),
        Timestamp: (0, aliyunRpcSign_1.aliyunTimestamp)(),
        SignatureMethod: "HMAC-SHA1",
        SignatureVersion: "1.0",
    };
    const signature = (0, aliyunRpcSign_1.signAliyunRpc)("POST", baseParams, opts.accessKeySecret);
    const signedParams = { ...baseParams, Signature: signature };
    const query = buildQueryString(signedParams);
    const url = `https://${endpoint}/?${query}`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream",
            Accept: "application/json",
        },
        body: new Uint8Array(imageBuffer),
    });
    const textBody = await res.text();
    let json;
    try {
        json = JSON.parse(textBody);
    }
    catch {
        throw new httpError_1.HttpError(502, "OCR_BAD_RESPONSE", "OCR 返回非 JSON");
    }
    if (!res.ok) {
        throw new httpError_1.HttpError(502, "OCR_HTTP", `上游 HTTP ${res.status}`);
    }
    if (json.Data == null && json.Code != null) {
        const msg = typeof json.Message === "string" ? json.Message : String(json.Code);
        throw new httpError_1.HttpError(502, "OCR_UPSTREAM", msg);
    }
    const dataField = json.Data;
    let text = "";
    if (typeof dataField === "string") {
        try {
            const inner = JSON.parse(dataField);
            text = (inner.content || "").trim();
            if (!text && Array.isArray(inner.prism_wordsInfo)) {
                text = inner.prism_wordsInfo
                    .map((w) => w.word)
                    .filter(Boolean)
                    .join("\n")
                    .trim();
            }
        }
        catch {
            text = dataField.trim();
        }
    }
    return { text, raw: json };
}
