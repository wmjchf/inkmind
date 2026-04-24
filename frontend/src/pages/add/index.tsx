import { View, Text, Input, Textarea } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useRef, useState } from "react";
import { ensureLogin } from "../../services/auth";
import { createEntry, suggestTags } from "../../services/entries";
import { recognizeImage } from "../../services/ocr";
import "./index.scss";

function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeTagLists(existing: string[], suggested: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (t: string) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  for (const t of existing) push(t);
  for (const t of suggested) push(t);
  return out;
}

function FieldLabel(props: { title: string; required?: boolean }) {
  const { title, required } = props;
  return (
    <View className="field-label-row">
      <View className="field-label-left">
        <Text className="label-text">{title}</Text>
        {required ? <Text className="label-req">*</Text> : null}
      </View>
    </View>
  );
}

export default function AddPage() {
  const [content, setContent] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [entrySource, setEntrySource] = useState<"manual" | "ocr">("manual");
  const ocrStartedRef = useRef(false);

  useLoad((q) => {
    const rawPath = Array.isArray(q.localPath) ? q.localPath[0] : q.localPath;
    const lp = typeof rawPath === "string" ? decodeURIComponent(rawPath) : "";
    const rawSrc = Array.isArray(q.source) ? q.source[0] : q.source;
    const src = rawSrc === "ocr" ? "ocr" : "manual";
    setEntrySource(src === "ocr" ? "ocr" : "manual");
    if (src === "ocr" || lp) {
      void Taro.setNavigationBarTitle({ title: lp ? "识别录入" : "添加收藏" });
    }

    if (!lp || src !== "ocr" || ocrStartedRef.current) return;
    ocrStartedRef.current = true;
    void (async () => {
      try {
        await ensureLogin();
        Taro.showLoading({ title: "识别中…", mask: true });
        const { text } = await recognizeImage(lp);
        const t = text.trim();
        const capped = t.length > 5000 ? t.slice(0, 5000) : t;
        setContent(capped);
        Taro.showToast({
          title: capped ? "已填入识别结果，请校对" : "未识别到文字，请手动输入",
          icon: capped ? "success" : "none",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "识别失败";
        Taro.showToast({ title: msg, icon: "none", duration: 3200 });
      } finally {
        Taro.hideLoading();
      }
    })();
  });

  const submit = async () => {
    const c = content.trim();
    if (!c) {
      Taro.showToast({ title: "请填写或识别内容", icon: "none" });
      return;
    }
    const bt = bookTitle.trim();
    if (!bt) {
      Taro.showToast({ title: "请填写书名", icon: "none" });
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
        bookTitle: bt,
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

  const aiSuggestTags = async () => {
    const c = content.trim();
    if (!c) {
      Taro.showToast({ title: "请先填写内容，再生成标签", icon: "none" });
      return;
    }
    try {
      await ensureLogin();
      Taro.showLoading({ title: "生成中…", mask: true });
      const existing = parseTagsInput(tagsRaw);
      const bt = bookTitle.trim();
      const { tags } = await suggestTags({
        content: c,
        existing,
        ...(bt ? { bookTitle: bt } : {}),
      });
      const merged = mergeTagLists(existing, tags);
      setTagsRaw(merged.join(", "));
      Taro.showToast({ title: "已填入，可继续修改", icon: "none" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      Taro.hideLoading();
    }
  };

  return (
    <View className="page">
      <View className="page-main">
        <View className="ai-hero">
          <Text className="ai-hero-kicker">InkMind · AI</Text>
          <Text className="ai-hero-title">伴你收录与整理</Text>
          <Text className="ai-hero-desc">
            保存后可在详情查看 AI 解读；标签区支持一键生成关键词，可随时改写。
          </Text>
        </View>

        <View className="form-card">
          <View className="form-section">
            <FieldLabel title="书名" required />
            <View className="field-wrap">
              <Input
                className="field"
                style={{ width: "100%", minHeight: "100rpx" }}
                placeholder="例如：《某某》"
                value={bookTitle}
                onInput={(e) => setBookTitle(e.detail.value)}
              />
            </View>
          </View>

          <View className="form-section">
            <FieldLabel title="内容" required />
            <View className="field-wrap">
              <Textarea
                className="field textarea"
                placeholder={
                  entrySource === "ocr" ? "识别结果可在此修改、删减或分段" : "粘贴或输入触动你的内容"
                }
                value={content}
                onInput={(e) => setContent(e.detail.value)}
                maxlength={5000}
              />
            </View>
          </View>

          <View className="form-section form-section-last">
            <View className="label-row-tags">
              <View className="field-label-left">
                <Text className="label-text">标签</Text>
                <Text className="label-optional">选填 · 逗号分隔</Text>
              </View>
              <View className="btn-tag-ai" onClick={() => void aiSuggestTags()}>
                <Text className="btn-tag-ai-text">AI 生成</Text>
              </View>
            </View>
            <Text className="label-hint-inline">生成后仍可自行增删</Text>
            <View className="field-wrap">
              <Input
                className="field field-tags"
                style={{ width: "100%", minHeight: "100rpx" }}
                placeholder="治愈, 成长"
                value={tagsRaw}
                onInput={(e) => setTagsRaw(e.detail.value)}
              />
            </View>
          </View>
        </View>
      </View>

      <View className="btn-bar">
        <View className="btn" onClick={() => void submit()}>
          <Text className="btn-text">保存</Text>
        </View>
      </View>
    </View>
  );
}
