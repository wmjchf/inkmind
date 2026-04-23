import { View, Text } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import { ensureLogin } from "../../services/auth";
import { deleteEntry, fetchEntryDetail, interpretEntry, type Interpretation } from "../../services/entries";
import "./index.scss";

export default function EntryDetailPage() {
  const [id, setId] = useState(0);
  const [content, setContent] = useState("");
  const [bookTitle, setBookTitle] = useState<string | null>(null);
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);

  const loadDetail = async (entryId: number) => {
    await ensureLogin();
    const res = await fetchEntryDetail(entryId);
    setContent(res.entry.content);
    setBookTitle(res.entry.book_title);
    setTags(res.entry.tags || []);
    setInterpretation(res.interpretation);
  };

  useLoad(async (q) => {
    const raw = q.id || (Taro.getCurrentInstance().router?.params?.id as string | undefined);
    const n = raw ? parseInt(String(raw), 10) : 0;
    const entryId = Number.isFinite(n) ? n : 0;
    setId(entryId);
    if (!entryId) {
      Taro.showToast({ title: "无效条目", icon: "none" });
      return;
    }
    try {
      await loadDetail(entryId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      Taro.showToast({ title: msg, icon: "none" });
    }
  });

  const onInterpret = async () => {
    if (!id) return;
    try {
      await ensureLogin();
      Taro.showLoading({ title: "解读中" });
      const res = await interpretEntry(id);
      setInterpretation(res.interpretation);
      Taro.hideLoading();
    } catch (e) {
      Taro.hideLoading();
      const msg = e instanceof Error ? e.message : "失败";
      Taro.showToast({ title: msg, icon: "none" });
    }
  };

  const onDelete = () => {
    if (!id) return;
    void Taro.showModal({
      title: "删除收藏？",
      content: "删除后无法恢复",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await ensureLogin();
          await deleteEntry(id);
          Taro.showToast({ title: "已删除", icon: "success" });
          setTimeout(() => Taro.switchTab({ url: "/pages/index/index" }), 400);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "删除失败";
          Taro.showToast({ title: msg, icon: "none" });
        }
      },
    });
  };

  return (
    <View className="page">
      {bookTitle ? (
        <View className="section-title" style={{ marginBottom: 8 }}>
          {bookTitle}
        </View>
      ) : null}
      <View className="content">{content || "…"}</View>
      {tags.length ? (
        <View className="section-title">标签：{tags.map((t) => t.name).join("、")}</View>
      ) : null}

      <View className="section-title" style={{ marginTop: 24 }}>
        AI 解读
      </View>
      {interpretation ? (
        <View className="inter-box">
          <Text>{interpretation.summary}</Text>
          {"\n\n"}
          <Text>{interpretation.resonance}</Text>
          {"\n\n"}
          <Text style={{ fontWeight: 600 }}>反思：{interpretation.reflection_question}</Text>
        </View>
      ) : (
        <View className="inter-box" style={{ color: "#888" }}>
          尚未生成解读，点击下方按钮。
        </View>
      )}

      <View className="actions">
        <View className="btn danger" onClick={onDelete}>
          删除
        </View>
        <View className="btn primary" onClick={() => void onInterpret()}>
          {interpretation ? "重新解读" : "生成解读"}
        </View>
      </View>
    </View>
  );
}
