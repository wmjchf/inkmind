import { View, Text, Input, ScrollView } from "@tarojs/components";
import Taro, { useDidShow, usePullDownRefresh, useReady } from "@tarojs/taro";
import { useCallback, useState } from "react";
import { ensureLogin } from "../../services/auth";
import { fetchEntries, fetchTags, type EntryItem, type Tag } from "../../services/entries";
import "./index.scss";

export default function IndexPage() {
  const [items, setItems] = useState<EntryItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagId, setTagId] = useState<number | undefined>();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(
    async (override?: { tagId?: number | undefined; q?: string }) => {
      const tid = override && "tagId" in override ? override.tagId : tagId;
      const qv = override && "q" in override ? override.q! : q;
      setLoading(true);
      try {
        await ensureLogin();
        const [listRes, tagRes] = await Promise.all([
          fetchEntries({
            page: 1,
            pageSize: 50,
            q: qv.trim() || undefined,
            tagId: tid,
          }),
          fetchTags(),
        ]);
        setItems(listRes.items);
        setTags(tagRes.items);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "加载失败";
        Taro.showToast({ title: msg, icon: "none" });
      } finally {
        setLoading(false);
        Taro.stopPullDownRefresh();
      }
    },
    [tagId, q]
  );

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
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/entry-detail/index?id=${id}` });
  };

  return (
    <ScrollView className="wrap" scrollY>
      <View className="toolbar">
        <Input
          className="search"
          placeholder="搜索句子"
          value={q}
          onInput={(e) => setQ(e.detail.value)}
          onConfirm={() => loadData({ q })}
        />
        <View className="search-btn" onClick={() => void loadData({ q })}>
          <Text>搜索</Text>
        </View>
      </View>

      <View className="tags-row">
        <View
          className={`tag-chip ${tagId ? "" : "on"}`}
          onClick={() => {
            setTagId(undefined);
            void loadData({ tagId: undefined });
          }}
        >
          全部
        </View>
        {tags.map((t) => (
          <View
            key={t.id}
            className={`tag-chip ${tagId === t.id ? "on" : ""}`}
            onClick={() => {
              setTagId(t.id);
              void loadData({ tagId: t.id });
            }}
          >
            {t.name}
          </View>
        ))}
      </View>

      {loading && items.length === 0 ? (
        <View className="empty">加载中…</View>
      ) : null}

      {!loading && items.length === 0 ? (
        <View className="empty">暂无收藏，点底部中间「＋」拍照即可添加</View>
      ) : null}

      {items.map((it) => (
        <View key={it.id} className="card" onClick={() => goDetail(it.id)}>
          <View className="card-text">{it.content}</View>
          <View className="card-meta">
            {it.book_title ? `${it.book_title} · ` : ""}
            {it.tags?.length ? it.tags.map((x) => x.name).join("、") : "无标签"}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
