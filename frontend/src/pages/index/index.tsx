import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro, { useDidShow, usePullDownRefresh, useReady } from "@tarojs/taro";
import { useCallback, useRef, useState } from "react";
import { listEmptyBook } from "../../assets/list-empty-icons";
import { ensureLogin } from "../../services/auth";
import { fetchEntries, fetchEntryBookTitles, type EntryItem } from "../../services/entries";
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

export default function IndexPage() {
  const [items, setItems] = useState<EntryItem[]>([]);
  const [bookTitles, setBookTitles] = useState<string[]>([]);
  const [selectedChipIndex, setSelectedChipIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const bookTitlesRef = useRef<string[]>([]);
  const selectedChipIndexRef = useRef(0);

  const chipLabels = bookTitles.length > 0 ? ["全部", ...bookTitles] : [];

  const loadBookTitles = useCallback(async (): Promise<string[]> => {
    await ensureLogin();
    const { items } = await fetchEntryBookTitles();
    bookTitlesRef.current = items;
    setBookTitles(items);
    return items;
  }, []);

  const loadEntries = useCallback(async (titles: string[], index: number) => {
    if (titles.length === 0) {
      selectedChipIndexRef.current = 0;
      setSelectedChipIndex(0);
      setLoading(true);
      try {
        await ensureLogin();
        const listRes = await fetchEntries({
          page: 1,
          pageSize: 50,
        });
        setItems(listRes.items);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "加载失败";
        Taro.showToast({ title: msg, icon: "none" });
      } finally {
        setLoading(false);
        Taro.stopPullDownRefresh();
      }
      return;
    }

    const range = ["全部", ...titles];
    const safeIndex = Math.min(Math.max(0, index), Math.max(0, range.length - 1));
    const bookTitle = safeIndex > 0 ? range[safeIndex] : undefined;
    selectedChipIndexRef.current = safeIndex;
    setSelectedChipIndex(safeIndex);
    setLoading(true);
    try {
      await ensureLogin();
      const listRes = await fetchEntries({
        page: 1,
        pageSize: 50,
        bookTitle,
      });
      setItems(listRes.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

  const refresh = useCallback(async () => {
    const titles = await loadBookTitles();
    if (titles.length === 0) {
      await loadEntries([], 0);
      return;
    }
    const nextIdx = Math.min(selectedChipIndexRef.current, titles.length);
    await loadEntries(titles, nextIdx);
  }, [loadBookTitles, loadEntries]);

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
    void refresh();
  });

  usePullDownRefresh(() => {
    void refresh();
  });

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/entry-detail/index?id=${id}` });
  };

  return (
    <View className="page">
      <View className="ai-hero">
        <Text className="ai-hero-kicker">InkMind · AI</Text>
        <Text className="ai-hero-title">我的收藏</Text>
        <Text className="ai-hero-desc">
          摘录与标签一目了然；详情里可生成 AI 解读。有书名时可在下方筛选，下拉页面可刷新列表。
        </Text>
      </View>

      {chipLabels.length > 0 ? (
        <View className="filter-wrap">
          <ScrollView className="tag-scroll" scrollX showScrollbar={false} enableFlex>
            <View className="tag-scroll-inner">
              {chipLabels.map((name, i) => (
                <View
                  key={i === 0 ? "__all__" : `${i}-${name}`}
                  className={`book-tag ${i === selectedChipIndex ? "on" : ""}`}
                  onClick={() => void loadEntries(bookTitlesRef.current, i)}
                >
                  <Text className="book-tag-text">{name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {items.length > 0 ? (
        <ScrollView className="list-scroll" scrollY>
          {items.map((it) => {
            const bookDisplay = formatBookTitleWithGuillemets(it.book_title);
            const tagLine = it.tags?.length ? it.tags.map((x) => x.name).join("、") : "无标签";
            return (
            <View key={it.id} className="card entry-card" onClick={() => goDetail(it.id)}>
              <View className="entry-card-fold" />
              <View className="card-text">{it.content}</View>
              <View className="card-meta">
                {bookDisplay ? <Text className="card-book">{bookDisplay}</Text> : null}
                {bookDisplay ? <Text className="card-meta-sep">·</Text> : null}
                <View className="card-tags-wrap">
                  <Text className="card-tags">{tagLine}</Text>
                </View>
              </View>
            </View>
            );
          })}
        </ScrollView>
      ) : (
        <View className="main-flex">
          {loading ? (
            <View className="empty empty-loading">加载中…</View>
          ) : (
            <View className="empty empty-centered">
              <Image className="empty-book" src={listEmptyBook} mode="aspectFit" />
              <View className="empty-hint">
                <Text className="empty-hint-text">拍书页后收藏</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
