"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestTagsFromContent = suggestTagsFromContent;
const aiChatConfig_1 = require("../lib/aiChatConfig");
const httpError_1 = require("../lib/httpError");
const MAX_TAGS = 6;
const MAX_NAME_LEN = 32;
function normalizeTagName(s) {
    const t = s.trim().slice(0, MAX_NAME_LEN);
    return t || null;
}
/** 未配置 DashScope / OpenAI 时的占位建议（仍便于联调） */
function stubSuggestions(content) {
    const n = content.trim().length;
    if (n > 80)
        return ["长句", "摘录"];
    if (n > 20)
        return ["短句", "摘录"];
    return ["摘录"];
}
/**
 * 根据摘录内容生成短标签（中文为主）。
 * 配置 DASHSCOPE_API_KEY 或 OPENAI_API_KEY 时走 Chat Completions（模型与解读共用 `AI_MODEL` / `AI_TAG_MODEL`）；否则占位。
 */
async function suggestTagsFromContent(content, existingNames, bookTitle) {
    const trimmed = content.trim();
    if (!trimmed)
        return [];
    const chat = (0, aiChatConfig_1.resolveChatCompletionConfig)();
    if (!chat) {
        return stubSuggestions(trimmed);
    }
    const { apiKey, baseUrl, model } = chat;
    const existingHint = existingNames.length > 0
        ? `用户已手动打的标签（请不要再输出同义重复，可补充不同维度）：${existingNames.join("、")}`
        : "用户尚未打标签。";
    const title = typeof bookTitle === "string" ? bookTitle.trim() : "";
    const bookHint = title
        ? `摘录出自图书：${title.slice(0, 120)}（请结合书名与正文语境打标签，不要把整本书名原样当作一个标签输出）。`
        : "用户未填写书名，请仅根据正文语境打标签。";
    const body = {
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: "你是阅读类 App 的标签助手。只输出 JSON 对象，键 tags 为字符串数组；每个标签 2～8 个汉字或常用词，不要带#号，不要书名号，3～6 个为宜。",
            },
            {
                role: "user",
                content: `${existingHint}\n${bookHint}\n\n内容：\n${trimmed.slice(0, 2000)}\n\n请输出 {"tags":["..."]}`,
            },
        ],
    };
    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) {
        throw new httpError_1.HttpError(502, "AI_TAG_UPSTREAM", raw.slice(0, 200));
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new httpError_1.HttpError(502, "AI_TAG_BAD_RESPONSE", "模型返回非 JSON");
    }
    const text = parsed.choices?.[0]?.message?.content || "{}";
    let tags;
    try {
        tags = JSON.parse(text).tags;
    }
    catch {
        throw new httpError_1.HttpError(502, "AI_TAG_PARSE", "模型 JSON 中无有效 tags");
    }
    if (!Array.isArray(tags))
        return [];
    const out = [];
    const seen = new Set();
    for (const item of tags) {
        if (typeof item !== "string")
            continue;
        const n = normalizeTagName(item);
        if (!n)
            continue;
        const keyLower = n.toLowerCase();
        if (seen.has(keyLower))
            continue;
        seen.add(keyLower);
        out.push(n);
        if (out.length >= MAX_TAGS)
            break;
    }
    return out;
}
