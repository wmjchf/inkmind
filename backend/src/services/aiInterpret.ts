import type { ChatCompletionConfig } from "../lib/aiChatConfig";
import { HttpError } from "../lib/httpError";

const MAX_FIELD = 2000;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type InterpretFields = {
  summary: string;
  resonance: string;
  reflection_question: string;
};

/**
 * 使用已解析的 Chat 配置调用模型（DashScope / OpenAI 兼容），返回 JSON 三字段。
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
    temperature: 0.5,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          "你是阅读类 App 的共读助手。只输出一个 JSON 对象，且必须包含三个字符串键：" +
          "summary（2～4 句，概括这句话在说什么、可能的多层含义）、resonance（2～4 句，从读者情绪与共鸣角度写，用「你」称呼读者）、reflection_question（恰好一句开放式反思问题，不要用多句罗列）。语气温暖克制，不要标题或 Markdown。",
      },
      {
        role: "user" as const,
        content: `${bookBlock}用户收藏的内容：\n${trimmed.slice(0, 4000)}\n\n请输出 {"summary":"...","resonance":"...","reflection_question":"..."}`,
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
  let obj: { summary?: unknown; resonance?: unknown; reflection_question?: unknown };
  try {
    obj = JSON.parse(text) as typeof obj;
  } catch {
    throw new HttpError(502, "AI_INTERPRET_PARSE", "模型 JSON 解析失败");
  }

  const summary = typeof obj.summary === "string" ? clip(obj.summary, MAX_FIELD) : "";
  const resonance = typeof obj.resonance === "string" ? clip(obj.resonance, MAX_FIELD) : "";
  const reflection_question =
    typeof obj.reflection_question === "string" ? clip(obj.reflection_question, 500) : "";

  if (!summary || !resonance || !reflection_question) {
    throw new HttpError(502, "AI_INTERPRET_FIELDS", "模型 JSON 缺少 summary / resonance / reflection_question");
  }

  return {
    summary,
    resonance,
    reflection_question,
    provider,
    model,
  };
}
