import { View, Text, Input, Textarea, Picker } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useCallback, useRef, useState } from "react";
import { ensureLogin } from "../../services/auth";
import { createEntry, fetchEntryBookTitles } from "../../services/entries";
import { requestIndexListRefresh } from "../../services/indexListRefreshFlag";
import { recognizeImage } from "../../services/ocr";
import "./index.scss";

export default function AddPage() {
  const [content, setContent] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [existingBookTitles, setExistingBookTitles] = useState<string[]>([]);
  const [entrySource, setEntrySource] = useState<"manual" | "ocr">("manual");
  const [saving, setSaving] = useState(false);
  const ocrStartedRef = useRef(false);
  /** 同步锁：网络慢时连点不会并发多次 createEntry */
  const submitLockRef = useRef(false);

  const loadExistingBookTitles = useCallback(async () => {
    try {
      await ensureLogin();
      const { items } = await fetchEntryBookTitles();
      setExistingBookTitles(items);
    } catch {
      /* 未登录等：仍可手动输入书名 */
    }
  }, []);

  useLoad((q) => {
    void loadExistingBookTitles();
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

  useDidShow(() => {
    void loadExistingBookTitles();
  });

  const submit = async () => {
    if (submitLockRef.current) return;
    const c = content.trim();
    if (!c) {
      Taro.showToast({ title: "请先填写摘录内容", icon: "none" });
      return;
    }
    const bt = bookTitle.trim();
    if (!bt) {
      Taro.showToast({ title: "请先填写书名", icon: "none" });
      return;
    }
    submitLockRef.current = true;
    setSaving(true);
    try {
      await ensureLogin();
      const res = await createEntry({
        content: c,
        bookTitle: bt,
        sourceType: entrySource,
      });
      requestIndexListRefresh();
      Taro.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/entry-detail/index?id=${res.id}` });
      }, 400);
      /* 成功：保持锁定至跳转离开本页，避免 toast 等待期间再次提交 */
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      Taro.showToast({ title: msg, icon: "none" });
      submitLockRef.current = false;
      setSaving(false);
    }
  };

  const contentPlaceholder =
    entrySource === "ocr"
      ? "识别结果可在此修改、删减；也可粘贴或输入内容。"
      : "在此粘贴或输入内容。";

  return (
    <View className="page-minimal">
      <View className="minimal-form">
        <View className="minimal-title-row">
          <Input
            className="minimal-title-input"
            placeholderClass="minimal-placeholder"
            placeholder="输入或选择书名"
            value={bookTitle}
            onInput={(e) => setBookTitle(e.detail.value)}
            maxlength={200}
          />
          {existingBookTitles.length > 0 ? (
            <Picker
              mode="selector"
              range={existingBookTitles}
              onChange={(e) => {
                const i = Number(e.detail.value);
                const t = existingBookTitles[i];
                if (typeof t === "string") setBookTitle(t);
              }}
            >
              <View
                className="minimal-title-picker"
                hoverClass="minimal-title-picker--pressed"
                hoverStayTime={70}
              >
                <Text className="minimal-title-picker-text">选书</Text>
              </View>
            </Picker>
          ) : null}
        </View>
        <Textarea
          className="minimal-body"
          placeholderClass="minimal-placeholder"
          placeholder={contentPlaceholder}
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={5000}
          showConfirmBar={false}
        />
      </View>

      <View className="btn-bar btn-bar-minimal">
        <View
          className={`btn ${saving ? "btn-disabled" : ""}`}
          onClick={() => !saving && void submit()}
        >
          <Text className="btn-text">{saving ? "保存中…" : "保存"}</Text>
        </View>
      </View>
    </View>
  );
}
