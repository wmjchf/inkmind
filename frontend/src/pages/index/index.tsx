import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro, { useDidShow, useLoad, usePullDownRefresh } from "@tarojs/taro";
import { useCallback, useRef, useState } from "react";
import { indexIcons } from "../../assets/index-icons";
import { listEmptyBook } from "../../assets/list-empty-icons";
import { ensureLogin } from "../../services/auth";
import { fetchEntries, fetchEntryBookTitles, type EntryItem } from "../../services/entries";
import { consumeIndexListRefreshRequest } from "../../services/indexListRefreshFlag";
import "./index.scss";

/** 列表展示用书名号《》；若已有成对《》则不再重复包裹 */
function formatBookTitleWithGuillemets(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("《") && t.endsWith("》") && t.length >= 4) return t;
  const inner = t.replace(/^[《\s]+/u, "").replace(/[》\s]+$/u, "").trim();
  if (!inner) return null;
  return `《${inner}》`;
}

/** 与书目摘录列表页一致 */
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

export default function IndexPage() {
  const [bookTitles, setBookTitles] = useState<string[]>([]);
  /** null = 全部书目下的收藏 */
  const [selectedBookTitle, setSelectedBookTitle] = useState<string | null>(null);
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedBookTitleRef = useRef<string | null>(null);
  selectedBookTitleRef.current = selectedBookTitle;

  const refresh = useCallback(async (bookFilter: string | null) => {
    setLoading(true);
    try {
      await ensureLogin();
      const [{ items: titles }, listRes] = await Promise.all([
        fetchEntryBookTitles(),
        fetchEntries({
          page: 1,
          pageSize: 50,
          bookTitle: bookFilter ?? undefined,
        }),
      ]);
      setBookTitles(titles);
      setEntries(listRes.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

  useLoad(() => {
    void refresh(null);
  });

  useDidShow(() => {
    if (consumeIndexListRefreshRequest()) {
      void refresh(selectedBookTitleRef.current);
    }
  });

  usePullDownRefresh(() => {
    void refresh(selectedBookTitleRef.current);
  });

  const onSelectBookFilter = (raw: string | null) => {
    setSelectedBookTitle(raw);
    setEntries([]);
    void refresh(raw);
  };

  const openEntryDetail = (entryId: number) => {
    void Taro.navigateTo({ url: `/pages/entry-detail/index?id=${entryId}` });
  };

  const hasBooks = bookTitles.length > 0;
  const showListScroll = hasBooks || entries.length > 0;

  return (
    <View className="page page-index-home">
      <View
        className="search-entry"
        onClick={() => Taro.navigateTo({ url: "/pages/search/index" })}
      >
        <Image className="search-entry-icon" src={indexIcons.search} mode="aspectFit" />
        <Text className="search-entry-placeholder">搜索收藏内容</Text>
      </View>

      {showListScroll ? (
        <>
          <View className="book-filter-wrap">
            <Text className="book-filter-label">书名</Text>
            <ScrollView className="book-filter-scroll" scrollX enhanced showScrollbar={false}>
              <View className="book-filter-inner">
                <View
                  className={`book-filter-chip ${selectedBookTitle === null ? "book-filter-chip--active" : ""}`}
                  onClick={() => onSelectBookFilter(null)}
                >
                  <Text className="book-filter-chip-text">全部</Text>
                </View>
                {bookTitles.map((raw) => {
                  const label = formatBookTitleWithGuillemets(raw) ?? raw;
                  return (
                    <View
                      key={raw}
                      className={`book-filter-chip ${selectedBookTitle === raw ? "book-filter-chip--active" : ""}`}
                      onClick={() => onSelectBookFilter(raw)}
                    >
                      <Text className="book-filter-chip-text">{label}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <ScrollView className="entries-scroll" scrollY enhanced showScrollbar={false}>
            <View className="entries-section-head">
              <Text className="entries-section-title">收藏</Text>
            </View>

            {entries.length > 0 ? (
              <View className="entries-list">
                {entries.map((it) => {
                  const bookLabel = formatBookTitleWithGuillemets(it.book_title) ?? it.book_title ?? "未命名书目";
                  const dateStr = formatEntryDateTime(it.created_at);
                  const preview = excerptPreviewText(it.content);
                  return (
                    <View
                      key={it.id}
                      className="card entry-card"
                      onClick={() => openEntryDetail(it.id)}
                    >
                      <View className="entry-card-fold" />
                      {!selectedBookTitle ? (
                        <Text className="entry-card-book-tag">{bookLabel}</Text>
                      ) : null}
                      <View className="card-text">{preview}</View>
                      <Text className="entry-card-time">{dateStr}</Text>
                    </View>
                  );
                })}
              </View>
            ) : loading ? (
              <View className="entries-placeholder">加载中…</View>
            ) : (
              <View className="entries-placeholder">
                <Text className="entries-placeholder-text">
                  {selectedBookTitle ? "该书下暂无摘录" : "暂无收藏，去添加一条吧"}
                </Text>
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <View className="main-flex">
          {loading ? (
            <View className="empty empty-loading">加载中…</View>
          ) : (
            <View className="empty empty-centered">
              <Image className="empty-book" src={listEmptyBook} mode="aspectFit" />
              <View className="empty-hint">
                <Text className="empty-hint-text">暂无书目与收藏，添加后会出现在这里</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
