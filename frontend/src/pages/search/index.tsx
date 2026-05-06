import { View, Text, Input, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureLogin } from "../../services/auth";
import { fetchEntries, type EntryItem } from "../../services/entries";
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

const SEARCH_DEBOUNCE_MS = 350;

export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<EntryItem[]>([]);
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
      const listRes = await fetchEntries({
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

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/entry-detail/index?id=${id}` });
  };

  const trimmed = keyword.trim();
  const emptyHint =
    !trimmed ? "输入关键词搜索收藏内容" : loading ? "搜索中…" : "未找到相关内容";

  return (
    <View className="page-search">
      <View className="search-bar-wrap">
        <View className="search-input-row">
          <Input
            className="search-input"
            type="text"
            confirmType="search"
            placeholder="搜索收藏内容"
            placeholderStyle="color:#bbbbbb"
            focus
            value={keyword}
            onInput={(e) => onInput(e.detail.value)}
            onConfirm={(e) => void runSearch(e.detail.value)}
          />
        </View>
      </View>

      {items.length > 0 ? (
        <ScrollView className="list-scroll-search" scrollY>
          {items.map((it) => {
            const bookDisplay = formatBookTitleWithGuillemets(it.book_title);
            return (
              <View key={it.id} className="card entry-card" onClick={() => goDetail(it.id)}>
                <View className="entry-card-fold" />
                <View className="card-text">{it.content}</View>
                {bookDisplay ? (
                  <View className="card-meta">
                    <Text className="card-book">{bookDisplay}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View className="empty-search">
          <Text className="empty-search-text">{emptyHint}</Text>
        </View>
      )}
    </View>
  );
}
