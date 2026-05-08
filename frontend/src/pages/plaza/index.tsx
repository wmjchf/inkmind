import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro, { useDidShow, usePullDownRefresh, useReady } from "@tarojs/taro";
import { useCallback, useState } from "react";
import { indexIcons } from "../../assets/index-icons";
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

export default function PlazaPage() {
  const [items, setItems] = useState<PlazaFeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPlaza = useCallback(async () => {
    setLoading(true);
    try {
      await ensureLogin();
      const res = await fetchPlazaFeed({
        page: 1,
        pageSize: 30,
      });
      setItems(res.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

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
    void loadPlaza();
  });

  usePullDownRefresh(() => {
    void loadPlaza();
  });

  const openDetail = (entryId: number) => {
    void Taro.navigateTo({ url: `/pages/entry-detail/index?id=${entryId}` });
  };

  const openPlazaSearch = () => {
    void Taro.navigateTo({ url: "/pages/plaza-search/index" });
  };

  const emptyDefaultHint =
    "暂时还没有公开内容。\n在摘录详情里打开「发布到广场」即可展示在这里。";

  return (
    <View className="page page-plaza">
      <View className="plaza-search-entry" onClick={openPlazaSearch}>
        <Image className="plaza-search-icon" src={indexIcons.search} mode="aspectFit" />
        <Text className="plaza-search-placeholder">搜索广场摘录或书名</Text>
      </View>

      <ScrollView className="plaza-scroll" scrollY enhanced showScrollbar={false}>
        {items.length === 0 ? (
          <View className="plaza-placeholder">
            <Text className="plaza-placeholder-text">
              {loading ? "加载中…" : emptyDefaultHint}
            </Text>
          </View>
        ) : (
          <View className="plaza-list">
            {items.map((it) => {
              const bookLabel =
                formatBookTitleWithGuillemets(it.book_title) ?? it.book_title ?? "";
              const preview = excerptPreviewText(it.content);
              const dateStr = formatEntryDateTime(it.created_at);
              return (
                <View
                  key={it.id}
                  className="card plaza-card"
                  onClick={() => openDetail(it.id)}
                >
                  {bookLabel ? <Text className="plaza-book">{bookLabel}</Text> : null}
                  <Text className="card-text">{preview}</Text>
                  <Text className="plaza-time">{dateStr}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
