import { apiRequest } from "./api";

export async function fetchMe() {
  return apiRequest<{
    id: number;
    nickname: string | null;
    avatarUrl: string | null;
    plan: string;
    entryCount: number;
    freeEntryLimit: number | null;
  }>({ url: "/me" });
}

export async function fetchStats() {
  return apiRequest<{
    totalEntries: number;
    entriesLast7d: number;
    interpretationRate: number;
  }>({ url: "/stats/summary" });
}
