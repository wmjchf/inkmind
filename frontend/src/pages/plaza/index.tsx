import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro, { useDidShow, useLoad, usePullDownRefresh, useReady } from "@tarojs/taro";
import { useCallback, useState } from "react";
import { PlazaFeedCard } from "../../components/plaza-feed-card";
import { indexIcons } from "../../assets/index-icons";
import { ensureLogin } from "../../services/auth";
import { fetchPlazaFeed, type PlazaFeedItem } from "../../services/plaza";
import "./index.scss";

export default function PlazaPage() {
  const [items, setItems] = useState<PlazaFeedItem[]>([]);
  /** 首屏 true，避免首帧空白误判为「无内容」 */
  const [loading, setLoading] = useState(true);

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

  /** 仅首次进入页面拉列表；切换 Tab 回来不重复请求，需更新时下拉刷新 */
  useLoad(() => {
    void loadPlaza();
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
            {items.map((it) => (
              <PlazaFeedCard
                key={it.id}
                item={it}
                showAuthor={false}
                onNavigateDetail={openDetail}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
