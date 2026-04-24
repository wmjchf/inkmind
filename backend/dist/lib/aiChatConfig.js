"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveChatCompletionConfig = resolveChatCompletionConfig;
/** 打标签与 AI 解读共用：`AI_MODEL` 优先，其次兼容旧名 `AI_TAG_MODEL`。 */
function resolveModelName() {
    return process.env.AI_MODEL?.trim() || process.env.AI_TAG_MODEL?.trim() || "";
}
/**
 * 优先 DashScope；否则 OpenAI 官方或其它 OpenAI 兼容网关。
 */
function resolveChatCompletionConfig() {
    const explicit = resolveModelName();
    const dash = process.env.DASHSCOPE_API_KEY?.trim();
    if (dash) {
        const baseUrl = (process.env.DASHSCOPE_BASE_URL?.trim() ||
            process.env.AI_CHAT_BASE_URL?.trim() ||
            "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
        const model = explicit || "qwen3.6-plus";
        return { apiKey: dash, baseUrl, model, provider: "dashscope" };
    }
    const openai = process.env.OPENAI_API_KEY?.trim();
    if (openai) {
        const baseUrl = (process.env.AI_CHAT_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
        const model = explicit || "gpt-4o-mini";
        return { apiKey: openai, baseUrl, model, provider: "openai" };
    }
    return null;
}
