"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretContentWithModel = interpretContentWithModel;
const aiChatConfig_1 = require("../lib/aiChatConfig");
const httpError_1 = require("../lib/httpError");
/** 解读正文入库硬上限（超出截断，防止列表/详情过长） */
const INTERPRET_TEXT_MAX = 520;
/** 摘录送入模型的长度上限（过长会拖慢推理，与模型名无关） */
const MAX_QUOTE_CHARS = 2400;
/** 限制模型生成长度（与较长解读、书中实例略述匹配） */
const INTERPRET_MAX_TOKENS = 900;
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
                    "【思考顺序】请在脑中按下列层次展开（写成输出时仍为一段连贯叙述，勿用小标题、勿写「第一」「第二」「首先其次」，勿用 Markdown）：" +
                    "（1）名词：从句子里挑出关键名词与专有概念，把它们与这本书（如有书名）所能提供的语境联系起来；说明这些名词之间有何区分、又何种照应或对立（差异与联系都要落到词义与上下文的衔接上）。" +
                    "（2）动词：聚焦叙述中的动作与行为取向，辨析「做了什么／未做什么／欲做未做」若文中有暗示；归纳行为的动机、缘由或出发点（谁在何种压力下行动或止步）。名词已铺垫的概念要在动词层面得到动作上的印证。" +
                    "（3）形容词（可选）：若摘录中含明显修饰人物、情境或判断的形容词／褒贬措辞，再简要点出透过这些词能看清主人公或叙述者（作者态度）的倾向；若无必要或文中几乎没有形容词，可一笔带过或省略，不必硬写。" +
                    "【书中实例】在以上词汇分析中，若有助于说明名词关联、动词动机或人物态度，可穿插与本书主题或人物关系相呼应的典型情境或情节作为例证（一两处即可，点到为止）。实例须满足其一：摘录字面已涉及；或书名常见读法下读者普遍知道的代表性场景（用「书中常见的……」「与书中……相呼应」等表述，勿冒充精确页码或冷门细节）；禁止捏造摘录未提示的具体人名、对话或章回走向。无把握则宁可只做词汇分析不写实例。" +
                    "不确定处须标明「据本段文字」「若联系全书常见读法则……」，禁止把臆测写成事实。" +
                    "篇幅：正文约 220～420 汉字为宜，允许写足一层名词辨析与一层动词动机，并视需要加入简短书中例证；仍是一段连贯叙述，勿列条款。" +
                    "只输出一个 JSON 对象，且只包含一个字符串键 text：一段完整正文。",
            },
            {
                role: "user",
                content: `${bookBlock}用户收藏的内容：\n${trimmed.slice(0, MAX_QUOTE_CHARS)}\n\n请按「名词—动词—形容词（按需）」解读；在有据可依时可结合书中典型情节或读者熟知的作品内例子作简要印证（勿编造冷门细节）。总篇幅约 240～420 字。输出 {"text":"……"}`,
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
