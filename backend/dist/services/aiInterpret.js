"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretContentWithModel = interpretContentWithModel;
const aiChatConfig_1 = require("../lib/aiChatConfig");
const httpError_1 = require("../lib/httpError");
/** 解读正文入库硬上限（超出截断，防止列表/详情过长） */
const INTERPRET_TEXT_MAX = 320;
/** 摘录送入模型的长度上限（过长会拖慢推理，与模型名无关） */
const MAX_QUOTE_CHARS = 2400;
/** 限制模型生成长度（与短篇解读匹配） */
const INTERPRET_MAX_TOKENS = 560;
function clip(s, max) {
    const t = s.trim();
    if (t.length <= max)
        return t;
    return `${t.slice(0, max - 1)}…`;
}
/**
 * 使用已解析的 Chat 配置调用模型（DashScope / OpenAI 兼容），返回 JSON 单字段正文。
 */
async function interpretContentWithModel(content, chat, bookTitle) {
    const trimmed = content.trim();
    if (!trimmed) {
        throw new httpError_1.HttpError(400, "VALIDATION", "content 不能为空");
    }
    const { apiKey, baseUrl, model, provider } = chat;
    const title = typeof bookTitle === "string" ? bookTitle.trim() : "";
    const bookBlock = title
        ? `该书摘录出自《${title.slice(0, 200)}》。可结合本书常见情节或公众熟知的作品内例子作印证，但不得编造摘录中未出现且无法由书名合理推断的具体细节。\n\n`
        : "";
    const body = {
        ...(0, aiChatConfig_1.interpretCompletionRequestShell)(provider),
        model,
        temperature: 0.42,
        max_tokens: INTERPRET_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: "你是 InkMind 的阅读解读助手，语气克制、书面化，不作鸡汤式抚慰。" +
                    "解读必须紧扣摘录中的词句，从词汇入手；禁止空谈哲理或与原文词面相脱节的泛泛而谈。" +
                    "【思考顺序】仅在脑中按下列层次组织，不得把层次名称写进正文：" +
                    "先抓关键概念与称谓如何在本句及书中语境里相互区分或呼应；再写人物行为与取舍背后的动机与压力；若文中有明显褒贬或态度色彩，再自然点出叙述立场。" +
                    "【面向读者的文风】输出是一段流畅的阅读札记式说明，像在与读者谈这段文字好在哪里、指向什么；严禁在正文里出现「名词」「动词」「形容词」「词性」「从……词入手」「语法上」等术语，严禁自我拆解结构（如「先谈名词再谈动词」）。读者不应看出你在按词类讲课。" +
                    "【书中实例】仅在篇幅允许时点到为止（至多一处简短带过）。实例须满足其一：摘录字面已涉及；或书名常见读法下读者熟知的代表性场景；禁止捏造细节。无把握则省略。" +
                    "不确定处须标明「据本段文字」「若联系全书常见读法则……」，禁止把臆测写成事实。" +
                    "篇幅务必简短：正文约 110～220 汉字；连贯成段，勿列条款。" +
                    "只输出一个 JSON 对象，且只包含一个字符串键 text：一段完整正文。",
            },
            {
                role: "user",
                content: `${bookBlock}用户收藏的内容：\n${trimmed.slice(0, MAX_QUOTE_CHARS)}\n\n请写一段面向读者的解读（概念辨析→行动与动机→态度若明显），简练为宜；有据时可一句带过书中常见呼应；正文禁止使用「名词」「动词」「形容词」等语法术语或讲课式拆解。总篇幅约 120～200 字。输出 {"text":"……"}`,
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
        throw new httpError_1.HttpError(502, "AI_INTERPRET_UPSTREAM", raw.slice(0, 200));
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new httpError_1.HttpError(502, "AI_INTERPRET_BAD_RESPONSE", "模型外层返回非 JSON");
    }
    const text = parsed.choices?.[0]?.message?.content || "{}";
    let obj;
    try {
        obj = JSON.parse(text);
    }
    catch {
        throw new httpError_1.HttpError(502, "AI_INTERPRET_PARSE", "模型 JSON 解析失败");
    }
    const bodyText = typeof obj.text === "string" ? clip(obj.text, INTERPRET_TEXT_MAX) : "";
    if (!bodyText.trim()) {
        throw new httpError_1.HttpError(502, "AI_INTERPRET_FIELDS", "模型 JSON 缺少非空 text");
    }
    return {
        text: bodyText,
        provider,
        model,
    };
}
