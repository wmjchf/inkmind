import { apiRequest } from "./api";

export type Tag = { id: number; name: string };

export type EntryItem = {
  id: number;
  content: string;
  source_type: "manual" | "ocr";
  book_title: string | null;
  note: string | null;
  created_at: string;
  tags: Tag[];
};

export type Interpretation = {
  id: number;
  summary: string;
  resonance: string;
  reflection_question: string;
  created_at: string;
};

export async function fetchEntries(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  tagId?: number;
  /** 与列表中书名完全一致时筛选 */
  bookTitle?: string;
}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.q) qs.set("q", params.q);
  if (params.tagId) qs.set("tagId", String(params.tagId));
  if (params.bookTitle) qs.set("bookTitle", params.bookTitle);
  const q = qs.toString();
  return apiRequest<{ items: EntryItem[]; total: number; page: number; pageSize: number }>({
    url: `/entries${q ? `?${q}` : ""}`,
  });
}

export async function fetchEntryBookTitles() {
  return apiRequest<{ items: string[] }>({ url: "/entries/book-titles" });
}

export async function fetchTags() {
  return apiRequest<{ items: Tag[] }>({ url: "/tags" });
}

/** 添加页等场景：根据正文建议标签，不写库；结果可再手动编辑 */
export async function suggestTags(body: {
  content: string;
  existing?: string[];
  /** 可选；有则一并交给模型，便于结合语境打标签 */
  bookTitle?: string;
}) {
  return apiRequest<{ tags: string[] }>({
    url: "/tags/suggest",
    method: "POST",
    data: body,
  });
}

export async function createEntry(body: {
  content: string;
  bookTitle?: string;
  note?: string;
  tags?: string[];
  sourceType?: "manual" | "ocr";
}) {
  return apiRequest<{ id: number }>({
    url: "/entries",
    method: "POST",
    data: {
      content: body.content,
      bookTitle: body.bookTitle,
      note: body.note,
      tags: body.tags,
      sourceType: body.sourceType,
    },
  });
}

export async function fetchEntryDetail(id: number) {
  return apiRequest<{
    entry: EntryItem & { source_image_url: string | null; updated_at: string };
    interpretation: Interpretation | null;
  }>({
    url: `/entries/${id}`,
  });
}

export async function updateEntry(
  id: number,
  body: {
    note?: string | null;
    content?: string;
    bookTitle?: string | null;
    tags?: string[];
  }
) {
  return apiRequest<{ ok: boolean }>({
    url: `/entries/${id}`,
    method: "PATCH",
    data: body,
  });
}

export async function deleteEntry(id: number) {
  return apiRequest<{ ok: boolean }>({ url: `/entries/${id}`, method: "DELETE" });
}

export async function interpretEntry(id: number) {
  return apiRequest<{ interpretation: Interpretation }>({
    url: `/entries/${id}/interpret`,
    method: "POST",
  });
}

export type AiTagStrategy = "merge" | "append_if_empty" | "replace_ai_only";

/** AI 打标签；默认 merge：与已有标签去重后只追加 */
export async function applyAiTagsToEntry(id: number, strategy: AiTagStrategy = "merge") {
  return apiRequest<{ added: string[]; skipped: boolean; reason?: string }>({
    url: `/entries/${id}/tags/ai`,
    method: "POST",
    data: { strategy },
  });
}

export async function fetchDailyRandom() {
  return apiRequest<{ item: EntryItem }>({ url: "/entries/daily-random" });
}
