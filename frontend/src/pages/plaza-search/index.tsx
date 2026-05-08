import { View, Text, Image, Input, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureLogin } from "../../services/auth";
import { fetchPlazaFeed, type PlazaFeedItem } from "../../services/plaza";
import "./index.scss";

function formatBookTitleWithGuillemets(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("《") && t.endsWith("》") && t.length >= 4) return t;
  const inner = t.replace(/^[《\s]+/u, "").replace(/[》\s]+$/u, "").trim();
  if (!inner) return null;
  return `《${inner}》`;
}

function formatEntryDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${day}日 ${hh}:${mm}`;
}

function excerptPreviewText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const SEARCH_DEBOUNCE_MS = 350;

export default function PlazaSearchPage() {
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<PlazaFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await ensureLogin();
      const listRes = await fetchPlazaFeed({
        page: 1,
        pageSize: 50,
        q: trimmed,
      });
      setItems(listRes.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "搜索失败";
      Taro.showToast({ title: msg, icon: "none" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== undefined) clearTimeout(debounceRef.current);
    };
  }, []);

  const onInput = (value: string) => {
    setKeyword(value);
    if (debounceRef.current !== undefined) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  };

  const goDetail = (entryId: number) => {
    void Taro.navigateTo({ url: `/pages/entry-detail/index?id=${entryId}` });
  };

  const trimmed = keyword.trim();
  const emptyHint = !trimmed
    ? "输入关键词搜索广场公开摘录"
    : loading
      ? "搜索中…"
      : "未找到相关公开摘录";

  return (
    <View className="page-plaza-search">
      <View className="search-bar-wrap">
        <View className="search-input-row">
          <Input
            className="search-input"
            type="text"
            confirmType="search"
            placeholder="搜索广场摘录或书名"
            placeholderStyle="color:#bbbbbb"
            focus
            value={keyword}
            onInput={(e) => onInput(e.detail.value)}
            onConfirm={(e) => void runSearch(e.detail.value)}
          />
        </View>
      </View>

      {items.length > 0 ? (
        <ScrollView className="list-scroll-plaza-search" scrollY>
          {items.map((it) => {
            const bookLabel =
              formatBookTitleWithGuillemets(it.book_title) ?? it.book_title ?? "";
            const preview = excerptPreviewText(it.content);
            const name = it.author.nickname?.trim() || "书友";
            const letter = name.slice(0, 1);
            const dateStr = formatEntryDateTime(it.created_at);
            return (
              <View
                key={it.id}
                className="plaza-search-card"
                onClick={() => goDetail(it.id)}
              >
                {/* <View className="plaza-author">
                  {it.author.avatarUrl ? (
                    <Image
                      className="plaza-avatar"
                      src={it.author.avatarUrl}
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="plaza-avatar plaza-avatar-placeholder">
                      <Text className="plaza-avatar-letter">{letter}</Text>
                    </View>
                  )}
                  <Text className="plaza-name">{name}</Text>
                </View> */}
                {bookLabel ? <Text className="plaza-book">{bookLabel}</Text> : null}
                <Text className="card-text">{preview}</Text>
                <Text className="plaza-time">{dateStr}</Text>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View className="empty-plaza-search">
          <Text className="empty-plaza-search-text">{emptyHint}</Text>
        </View>
      )}
    </View>
  );
}
