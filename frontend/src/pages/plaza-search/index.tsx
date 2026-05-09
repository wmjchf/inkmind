import { View, Text, Input, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlazaFeedCard } from "../../components/plaza-feed-card";
import { ensureLogin } from "../../services/auth";
import { fetchPlazaFeed, type PlazaFeedItem } from "../../services/plaza";
import "./index.scss";

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
          <View className="plaza-search-cards">
            {items.map((it) => (
              <PlazaFeedCard
                key={it.id}
                item={it}
                // showAuthor
                onNavigateDetail={goDetail}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="empty-plaza-search">
          <Text className="empty-plaza-search-text">{emptyHint}</Text>
        </View>
      )}
    </View>
  );
}
