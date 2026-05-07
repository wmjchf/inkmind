import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro, { useDidShow, useLoad, usePullDownRefresh, useReady } from "@tarojs/taro";
import { useCallback, useState } from "react";
import { indexIcons } from "../../assets/index-icons";
import { listEmptyBook } from "../../assets/list-empty-icons";
import { ensureLogin } from "../../services/auth";
import { fetchBookShelf, type BookShelfItem } from "../../services/entries";
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

function formatShelfDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 列表预览：折叠空白，便于 line-clamp 在小程序里稳定生效 */
function excerptPreviewText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export default function IndexPage() {
  const [shelfItems, setShelfItems] = useState<BookShelfItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await ensureLogin();
      const { items } = await fetchBookShelf();
      setShelfItems(items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

  useLoad(() => {
    void refresh();
  });

  useReady(() => {
    const page = Taro.getCurrentInstance().page;
    if (!page) return;
    const tabBar = Taro.getTabBar<{ setSelected: (n: number) => void }>(page);
    tabBar?.setSelected?.(0);
  });

  useDidShow(() => {
    const page = Taro.getCurrentInstance().page;
    if (page) {
      const tabBar = Taro.getTabBar<{ setSelected: (n: number) => void }>(page);
      tabBar?.setSelected?.(0);
    }
    if (consumeIndexListRefreshRequest()) {
      void refresh();
    }
  });

  usePullDownRefresh(() => {
    void refresh();
  });

  const openBook = (rawTitle: string) => {
    const q = encodeURIComponent(rawTitle);
    void Taro.navigateTo({ url: `/pages/book-entries/index?title=${q}` });
  };

  const openEntryDetail = (entryId: number) => {
    void Taro.navigateTo({ url: `/pages/entry-detail/index?id=${entryId}` });
  };

  return (
    <View className="page page-bookshelf">
      <View
        className="search-entry"
        onClick={() => Taro.navigateTo({ url: "/pages/search/index" })}
      >
        <Image className="search-entry-icon" src={indexIcons.search} mode="aspectFit" />
        <Text className="search-entry-placeholder">搜索收藏内容</Text>
      </View>

      {shelfItems.length > 0 ? (
        <ScrollView className="bookshelf-scroll" scrollY enhanced showScrollbar={false}>
          <View className="shelf-list">
            {shelfItems.map((row) => {
              const raw = row.book_title;
              const display = formatBookTitleWithGuillemets(raw) ?? raw;
              const dateLabel = formatShelfDate(row.latest_entry.created_at);
              return (
                <View key={raw} className="shelf-card">
                  <View
                    className="shelf-card-title-row"
                    hoverClass="shelf-card-title-row--pressed"
                    hoverStayTime={70}
                    onClick={() => openBook(raw)}
                  >
                    <Text className="shelf-card-title">{display}</Text>
                    <Text className="shelf-card-title-action">全部摘录 ›</Text>
                  </View>
                  <View
                    className="shelf-card-body"
                    onClick={() => openEntryDetail(row.latest_entry.id)}
                  >
                    <Text className="shelf-card-excerpt">
                      {excerptPreviewText(row.latest_entry.content)}
                    </Text>
                    <Text className="shelf-card-meta">
                      {dateLabel ? `${dateLabel} · ` : ""}最近摘录
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View className="main-flex">
          {loading ? (
            <View className="empty empty-loading">加载中…</View>
          ) : (
            <View className="empty empty-centered">
              <Image className="empty-book" src={listEmptyBook} mode="aspectFit" />
              <View className="empty-hint">
                <Text className="empty-hint-text">暂无书目，添加收藏后会按书名出现在这里</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
