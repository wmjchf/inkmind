import { View, Text, Input, Textarea, Image } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import { ensureLogin } from "../../services/auth";
import { createEntry } from "../../services/entries";
import "./index.scss";

export default function AddPage() {
  const [content, setContent] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [localImagePath, setLocalImagePath] = useState("");
  const [entrySource, setEntrySource] = useState<"manual" | "ocr">("manual");

  useLoad((q) => {
    const rawPath = Array.isArray(q.localPath) ? q.localPath[0] : q.localPath;
    const lp = typeof rawPath === "string" ? decodeURIComponent(rawPath) : "";
    const rawSrc = Array.isArray(q.source) ? q.source[0] : q.source;
    const src = rawSrc === "ocr" ? "ocr" : "manual";
    if (lp) setLocalImagePath(lp);
    setEntrySource(src === "ocr" ? "ocr" : "manual");
    if (src === "ocr" || lp) {
      void Taro.setNavigationBarTitle({ title: lp ? "拍照识字" : "添加收藏" });
    }
  });

  const submit = async () => {
    const c = content.trim();
    if (!c) {
      Taro.showToast({ title: "请填写或识别句子", icon: "none" });
      return;
    }
    try {
      await ensureLogin();
      const tags = tagsRaw
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await createEntry({
        content: c,
        bookTitle: bookTitle.trim() || undefined,
        tags: tags.length ? tags : undefined,
        sourceType: entrySource,
      });
      Taro.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/entry-detail/index?id=${res.id}` });
      }, 400);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      Taro.showToast({ title: msg, icon: "none" });
    }
  };

  return (
    <View className="page">
      {localImagePath ? (
        <View className="preview-block">
          <Image className="preview-img" src={localImagePath} mode="widthFix" />
          <Text className="preview-tip">
            第三方 OCR 接入后将自动填入文字；请先对照图片手动输入或校对。
          </Text>
        </View>
      ) : null}

      <View className="label">句子 *</View>
      <Textarea
        className="field textarea"
        placeholder={
          entrySource === "ocr"
            ? "拍照后请在此输入或粘贴书中句子（OCR 待接入）"
            : "粘贴或输入触动你的句子"
        }
        value={content}
        onInput={(e) => setContent(e.detail.value)}
        maxlength={5000}
      />

      <View className="label">书名（可选）</View>
      <Input
        className="field"
        placeholder="例如：《某某》"
        value={bookTitle}
        onInput={(e) => setBookTitle(e.detail.value)}
      />

      <View className="label">标签（可选，逗号分隔）</View>
      <Input
        className="field"
        placeholder="治愈, 成长"
        value={tagsRaw}
        onInput={(e) => setTagsRaw(e.detail.value)}
      />

      <View className="btn" onClick={() => void submit()}>
        保存
      </View>
    </View>
  );
}
