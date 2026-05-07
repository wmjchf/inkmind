import { View, Text, Image } from "@tarojs/components";
import Taro, { useDidShow, useReady } from "@tarojs/taro";
import { useState } from "react";
import { ensureLogin } from "../../services/auth";
import { fetchDailyRandom } from "../../services/entries";
import { fetchStats } from "../../services/me";
import { profileIcons } from "../../assets/profile-icons";
import dailyReviewIcon from "@/assets/review.svg";
import "./index.scss";

export default function ProfilePage() {
  const [stats, setStats] = useState<{
    totalEntries: number;
    entriesWithInterpretation: number;
  } | null>(null);

  const load = async () => {
    try {
      await ensureLogin();
      const s = await fetchStats();
      setStats({
        totalEntries: s.totalEntries,
        entriesWithInterpretation: s.entriesWithInterpretation,
      });
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
      {/* 账户（会员档位 / 用量）区块暂时隐藏；恢复时需再接 fetchMe + me state + 原 card */}

      {/* <View className="stats-header">
        <View className="stats-row">
          <View className="stat-card">
            <View className="stat-card-head">
              <Image className="stat-card-icon" src={profileIcons.book} mode="aspectFit" />
              <Text className="stat-label">总收藏</Text>
            </View>
            <Text className="stat-value stat-value-hero">{stats?.totalEntries ?? "—"}</Text>
          </View>
          <View className="stat-card">
            <View className="stat-card-head">
              <Image className="stat-card-icon" src={profileIcons.percent} mode="aspectFit" />
              <Text className="stat-label">文章解读</Text>
            </View>
            <Text className="stat-value stat-value-hero">
              {stats?.entriesWithInterpretation ?? "—"}
            </Text>
          </View>
        </View>
      </View> */}

      <View
        className="card card-year-summary card-year-summary--disabled"
        onClick={() => Taro.showToast({ title: "敬请期待", icon: "none" })}
      >
        <View className="year-summary-head">
          <Image className="year-summary-icon" src={profileIcons.chart} mode="aspectFit" />
          <View className="year-summary-copy">
            <Text className="year-summary-badge">年度</Text>
            <Text className="year-summary-title">年度总结</Text>
            <View className="year-summary-sub">回顾这一年的阅读与摘录</View>
          </View>
        </View>
      </View>

      <View className="card card-daily" onClick={() => void daily()}>
        <View className="daily-head">
          <Image className="daily-icon" src={dailyReviewIcon} mode="aspectFit" />
          <View className="daily-copy">
            <Text className="daily-badge">回顾</Text>
            <Text className="daily-title">今日随机回顾</Text>
            <View className="muted daily-sub">随机打开一条收藏，适合碎片时间重温</View>
          </View>
        </View>
      </View>

      <View
        className="card action-card"
        onClick={() => void Taro.navigateTo({ url: "/pages/feedback/index" })}
      >
        <View className="action-head">
          <Image className="action-icon" src={profileIcons.feedback} mode="aspectFit" />
          <View className="action-copy">
            <Text className="action-badge">帮助</Text>
            <Text className="action-title">意见反馈</Text>
            <View className="muted">遇到问题或有产品建议，告诉我们</View>
          </View>
        </View>
      </View>
    </View>
  );
}
