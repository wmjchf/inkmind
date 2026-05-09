import { apiRequest } from "./api";

export type PlazaAuthor = { nickname: string | null; avatarUrl: string | null };

export type PlazaFeedItem = {
  id: number;
  content: string;
  book_title: string | null;
  created_at: string;
  author: PlazaAuthor;
  /** 摘录点赞总数（entries.like_count） */
  likeCount: number;
  /** 收录他人摘录「收藏」人数（entry_saves 条数） */
  saveCount: number;
};

export async function fetchPlazaFeed(params: {
  page?: number;
  pageSize?: number;
  /** 搜索正文或书名 */
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.q?.trim()) qs.set("q", params.q.trim());
  const q = qs.toString();
  return apiRequest<{
    items: PlazaFeedItem[];
    total: number;
    page: number;
    pageSize: number;
  }>({ url: `/plaza${q ? `?${q}` : ""}` });
}
