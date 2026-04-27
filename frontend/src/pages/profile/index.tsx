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
    entriesLast7d: number;
    interpretationRate: number;
  } | null>(null);

  const load = async () => {
    try {
      await ensureLogin();
      const s = await fetchStats();
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
      <View className="ai-hero">
        <View className="ai-hero-head">
          <Image className="ai-hero-icon" src={profileIcons.hero} mode="aspectFit" />
          <View className="ai-hero-copy">
            <Text className="ai-hero-kicker">InkMind · AI</Text>
            <Text className="ai-hero-title">我的阅读空间</Text>
            <Text className="ai-hero-desc">
              在这里手动收录摘录、查看数据与解读覆盖；也可用「今日随机」在碎片时间重温一条收藏。
            </Text>
          </View>
        </View>
      </View>

      {/* 账户（会员档位 / 用量）区块暂时隐藏；恢复时需再接 fetchMe + me state + 原 card */}

      <View
        className="card action-card"
        onClick={() => void Taro.navigateTo({ url: "/pages/add/index?source=manual" })}
      >
        <View className="action-head">
          <Image className="action-icon" src={profileIcons.add} mode="aspectFit" />
          <View className="action-copy">
            <Text className="action-badge">收录</Text>
            <Text className="action-title">手动添加</Text>
            <View className="muted">不用拍书页时，在此输入或粘贴文字</View>
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

      <View className="card">
        <View className="card-kicker-row">
          <Image className="card-kicker-icon" src={profileIcons.chart} mode="aspectFit" />
          <Text className="card-kicker">数据</Text>
        </View>
        <View className="row">
          <View className="row-left">
            <Image className="row-icon" src={profileIcons.book} mode="aspectFit" />
            <Text>总收藏</Text>
          </View>
          <Text>{stats?.totalEntries ?? "—"}</Text>
        </View>
        <View className="row">
          <View className="row-left">
            <Image className="row-icon" src={profileIcons.calendar} mode="aspectFit" />
            <Text>近 7 日新增</Text>
          </View>
          <Text>{stats?.entriesLast7d ?? "—"}</Text>
        </View>
        <View className="row">
          <View className="row-left">
            <Image className="row-icon" src={profileIcons.percent} mode="aspectFit" />
            <Text>解读覆盖率</Text>
          </View>
          <Text>{stats != null ? `${Math.round(stats.interpretationRate * 100)}%` : "—"}</Text>
        </View>
      </View>
    </View>
  );
}
