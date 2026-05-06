import type { ChatCompletionConfig } from "../lib/aiChatConfig";
import { HttpError } from "../lib/httpError";

/** 一段话陪伴解读，略放宽上限 */
const MAX_BODY = 3500;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type InterpretFields = {
  /** 单段情绪陪伴式解读（入库时写入 summary，另两列留空以兼容旧表结构） */
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
    model,
    temperature: 0.62,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          "你是 InkMind 的阅读情绪陪伴者：温柔、真诚、不说教。用户收藏了一段文字，你要陪 TA 一起感受这段话的分量。" +
          "只输出一个 JSON 对象，且只包含一个字符串键 text：一段完整正文（约 200～450 字为宜，可适当增减）。" +
          "写成连贯的一段话，不要分小节、不要列标题、不要用 Markdown；可用「你」称呼读者，适度使用比喻与停顿，像朋友在耳边轻声聊两句。" +
          "内容可包含：这句话可能在说什么、为何容易触动人心、读的时候你心里可能会泛起什么——但不要冒充心理咨询师或下诊断；" +
          "若摘录出自某部作品，可轻轻带一笔语境，不必复述剧情。" +
          "禁止编造书名情节细节；不确定时用委婉措辞。整体语气温暖克制。",
      },
      {
        role: "user" as const,
        content: `${bookBlock}用户收藏的内容：\n${trimmed.slice(0, 4000)}\n\n请输出 {"text":"……"}`,
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

  const bodyText = typeof obj.text === "string" ? clip(obj.text, MAX_BODY) : "";

  if (!bodyText.trim()) {
    throw new HttpError(502, "AI_INTERPRET_FIELDS", "模型 JSON 缺少非空 text");
  }

  return {
    text: bodyText,
    provider,
    model,
  };
}
