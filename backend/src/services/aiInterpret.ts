import {
  interpretCompletionRequestShell,
  type ChatCompletionConfig,
} from "../lib/aiChatConfig";
import { HttpError } from "../lib/httpError";

/** 解读正文入库硬上限（超出截断，防止列表/详情过长） */
const INTERPRET_TEXT_MAX = 280;
/** 摘录送入模型的长度上限（过长会拖慢推理，与模型名无关） */
const MAX_QUOTE_CHARS = 2400;
/** 限制模型生成长度，与「短文解读」目标一致 */
const INTERPRET_MAX_TOKENS = 380;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type InterpretFields = {
  /** 单段严肃、事实问题向解读（入库时写入 summary，另两列留空以兼容旧表结构） */
  text: string;
};

/**
 * 使用已解析的 Chat 配置调用模型（DashScope / OpenAI 兼容），返回 JSON 单字段正文。
 */
export async function interpretContentWithModel(
  content: string,
  chat: ChatCompletionConfig,
  bookTitle?: string | null
): Promise<InterpretFields & { provider: string; model: string }> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new HttpError(400, "VALIDATION", "content 不能为空");
  }

  const { apiKey, baseUrl, model, provider } = chat;

  const title = typeof bookTitle === "string" ? bookTitle.trim() : "";
  const bookBlock = title
    ? `该书摘录出自《${title.slice(0, 200)}》，解读时请适当联系作品语境（不必大段介绍全书剧情）。\n\n`
    : "";

  const body = {
    ...interpretCompletionRequestShell(provider),
    model,
    temperature: 0.42,
    max_tokens: INTERPRET_MAX_TOKENS,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          "你是 InkMind 的阅读解读助手，语气严肃、克制、书面化，不作情感抚慰或鸡汤。" +
          "用户收藏了一段摘录，你要基于文本本身做解读：优先从可核对的事实层面入手——字面义、概念界定、前提与结论、论证结构或修辞作用；指出这段话在讨论什么问题、隐含何种判断或张力（「提出了什么问题」而非揣测读者心情）。" +
          "【具体化要求】避免只写抽象概括或排比式大词。须有一次简短「落地」：用一两句话给出与摘录可衔接的具体锚点（日常情境、对话片段或可控类比）；不要臆造摘录未出现的本书情节；类比须标明「例如」「类比而言」。" +
          "不要第二人称倾诉、不要用「陪伴」「共鸣」类话术；避免心理咨询或人生指导口吻；不确定的事实须标明「据摘录只能看出……」「若联系书名则可能是……」并避免编造情节。" +
          "篇幅务必精炼：正文约 80～160 汉字为宜，切忌冗长铺陈；具体锚点点到为止，勿再展开成第二段论述。" +
          "只输出一个 JSON 对象，且只包含一个字符串键 text：一段完整正文。连贯成段，不分小节、无标题、无 Markdown；分析与归纳为主，比喻仅用于锚定理解。",
      },
      {
        role: "user" as const,
        content: `${bookBlock}用户收藏的内容：\n${trimmed.slice(0, MAX_QUOTE_CHARS)}\n\n请按上述要求做简练解读（须含一处简短具体锚点，总篇幅控制在约 160 字以内），并输出 {"text":"……"}`,
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
    throw new HttpError(502, "AI_INTERPRET_UPSTREAM", raw.slice(0, 200));
  }

  let parsed: { choices?: { message?: { content?: string } }[] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new HttpError(502, "AI_INTERPRET_BAD_RESPONSE", "模型外层返回非 JSON");
  }

  const text = parsed.choices?.[0]?.message?.content || "{}";
  let obj: { text?: unknown };
  try {
    obj = JSON.parse(text) as typeof obj;
  } catch {
    throw new HttpError(502, "AI_INTERPRET_PARSE", "模型 JSON 解析失败");
  }

  const bodyText = typeof obj.text === "string" ? clip(obj.text, INTERPRET_TEXT_MAX) : "";

  if (!bodyText.trim()) {
    throw new HttpError(502, "AI_INTERPRET_FIELDS", "模型 JSON 缺少非空 text");
  }

  return {
    text: bodyText,
    provider,
    model,
  };
}
