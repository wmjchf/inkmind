import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useReady } from "@tarojs/taro";
import { useState } from "react";
import { ensureLogin } from "../../services/auth";
import { fetchDailyRandom } from "../../services/entries";
import { fetchMe, fetchStats } from "../../services/me";
import "./index.scss";

export default function ProfilePage() {
  const [me, setMe] = useState<{
    entryCount: number;
    plan: string;
    freeEntryLimit: number | null;
  } | null>(null);
  const [stats, setStats] = useState<{
    totalEntries: number;
    entriesLast7d: number;
    interpretationRate: number;
  } | null>(null);

  const load = async () => {
    try {
      await ensureLogin();
      const [m, s] = await Promise.all([fetchMe(), fetchStats()]);
      setMe({
        entryCount: m.entryCount,
        plan: m.plan,
        freeEntryLimit: m.freeEntryLimit,
      });
      setStats(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      Taro.showToast({ title: msg, icon: "none" });
    }
  };

  useReady(() => {
    const page = Taro.getCurrentInstance().page;
    if (!page) return;
    const tabBar = Taro.getTabBar<{ setSelected: (n: number) => void }>(page);
    tabBar?.setSelected?.(2);
  });

  useDidShow(() => {
    const page = Taro.getCurrentInstance().page;
    if (page) {
      const tabBar = Taro.getTabBar<{ setSelected: (n: number) => void }>(page);
      tabBar?.setSelected?.(2);
    }
    void load();
  });

  const daily = async () => {
    try {
      await ensureLogin();
      const res = await fetchDailyRandom();
      Taro.navigateTo({ url: `/pages/entry-detail/index?id=${res.item.id}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "暂无随机条目";
      Taro.showToast({ title: msg, icon: "none" });
    }
  };

  return (
    <View className="page">
      <View
        className="card action-card"
        onClick={() => void Taro.navigateTo({ url: "/pages/add/index?source=manual" })}
      >
        <Text className="action-title">手动添加金句</Text>
        <View className="muted">不拍照时，在此输入或粘贴文字</View>
      </View>

      <View className="card">
        <View className="row">
          <Text>会员档位</Text>
          <Text>{me?.plan === "pro" ? "Pro" : "免费"}</Text>
        </View>
        {me?.freeEntryLimit != null ? (
          <View className="row">
            <Text>收藏用量</Text>
            <Text>
              {me.entryCount} / {me.freeEntryLimit}
            </Text>
          </View>
        ) : (
          <View className="row">
            <Text>收藏条数</Text>
            <Text>{me?.entryCount ?? "—"}</Text>
          </View>
        )}
      </View>

      <View className="card">
        <View className="row">
          <Text>总收藏</Text>
          <Text>{stats?.totalEntries ?? "—"}</Text>
        </View>
        <View className="row">
          <Text>近 7 日新增</Text>
          <Text>{stats?.entriesLast7d ?? "—"}</Text>
        </View>
        <View className="row">
          <Text>解读覆盖率</Text>
          <Text>{stats != null ? `${Math.round(stats.interpretationRate * 100)}%` : "—"}</Text>
        </View>
      </View>

      <View className="card" onClick={() => void daily()}>
        <Text style={{ fontSize: 30 }}>今日随机回顾</Text>
        <View className="muted" style={{ marginTop: 8 }}>
          随机打开一条收藏
        </View>
      </View>
    </View>
  );
}
