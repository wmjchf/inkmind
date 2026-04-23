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
}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.q) qs.set("q", params.q);
  if (params.tagId) qs.set("tagId", String(params.tagId));
  const q = qs.toString();
  return apiRequest<{ items: EntryItem[]; total: number; page: number; pageSize: number }>({
    url: `/entries${q ? `?${q}` : ""}`,
  });
}

export async function fetchTags() {
  return apiRequest<{ items: Tag[] }>({ url: "/tags" });
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

export async function deleteEntry(id: number) {
  return apiRequest<{ ok: boolean }>({ url: `/entries/${id}`, method: "DELETE" });
}

export async function interpretEntry(id: number) {
  return apiRequest<{ interpretation: Interpretation }>({
    url: `/entries/${id}/interpret`,
    method: "POST",
  });
}

export async function fetchDailyRandom() {
  return apiRequest<{ item: EntryItem }>({ url: "/entries/daily-random" });
}
