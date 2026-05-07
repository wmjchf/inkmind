import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useDidShow, useLoad, usePullDownRefresh } from "@tarojs/taro";
import { useCallback, useRef, useState } from "react";
import { ensureLogin } from "../../services/auth";
import { fetchEntries, type EntryItem } from "../../services/entries";
import { consumeIndexListRefreshRequest } from "../../services/indexListRefreshFlag";
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

function navTitleFromBook(raw: string): string {
  const g = formatBookTitleWithGuillemets(raw);
  const s = g ?? raw.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 14)}…`;
}

/** 摘录创建时间：年月日 + 时分 */
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

export default function BookEntriesPage() {
  const [items, setItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const bookTitleRef = useRef("");

  const loadEntries = useCallback(async () => {
    const bookTitle = bookTitleRef.current;
    if (!bookTitle) return;
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

  useLoad(() => {
    const routerParams = Taro.getCurrentInstance().router?.params || {};
    const rawTitle = routerParams.title;
    const titleStr = Array.isArray(rawTitle) ? rawTitle[0] : rawTitle;
    let decoded = typeof titleStr === "string" ? titleStr.trim() : "";
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      /* 已是明文 */
    }
    if (!decoded) {
      Taro.showToast({ title: "缺少书名", icon: "none" });
      setLoading(false);
      return;
    }
    bookTitleRef.current = decoded;
    void Taro.setNavigationBarTitle({ title: navTitleFromBook(decoded) });
    void loadEntries();
  });

  useDidShow(() => {
    if (!bookTitleRef.current) return;
    if (consumeIndexListRefreshRequest()) {
      void loadEntries();
    }
  });

  usePullDownRefresh(() => {
    void loadEntries();
  });

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/entry-detail/index?id=${id}` });
  };

  return (
    <View className="page page-book-entries">
      {loading && items.length === 0 ? (
        <View className="main-flex">
          <View className="empty empty-loading">加载中…</View>
        </View>
      ) : items.length > 0 ? (
        <ScrollView className="list-scroll" scrollY>
          {items.map((it) => (
            <View key={it.id} className="card entry-card" onClick={() => goDetail(it.id)}>
              <View className="entry-card-fold" />
              <View className="card-text">{it.content}</View>
              <Text className="entry-card-time">{formatEntryDateTime(it.created_at)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="main-flex">
          <View className="empty empty-centered">
            <Text className="empty-hint-text">本书暂无摘录</Text>
          </View>
        </View>
      )}
    </View>
  );
}
