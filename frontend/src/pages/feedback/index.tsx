import { View, Text, Textarea, Input } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useState } from "react";
import { ensureLogin } from "../../services/auth";
import { submitFeedback } from "../../services/feedback";
import "./index.scss";

const MAX_CONTENT = 2000;
const MAX_CONTACT = 120;

export default function FeedbackPage() {
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      Taro.showToast({ title: "请填写反馈内容", icon: "none" });
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await ensureLogin();
      await submitFeedback({
        content: trimmed.slice(0, MAX_CONTENT),
        contact: contact.trim().slice(0, MAX_CONTACT) || null,
      });
      Taro.showToast({ title: "感谢反馈", icon: "success" });
      setTimeout(() => Taro.navigateBack(), 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "提交失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="page">
      <Text className="lead">
        描述你遇到的问题或希望改进的方向。可选填联系方式，便于我们必要时回复你。
      </Text>

      <View className="field-block">
        <Text className="field-label">反馈内容</Text>
        <Text className="field-hint">必填，最多 {MAX_CONTENT} 字</Text>
        <Textarea
          className="textarea"
          value={content}
          maxlength={MAX_CONTENT}
          placeholder="例如：某页按钮点击无反应、希望增加某某功能…"
          onInput={(e) => setContent(e.detail.value)}
        />
        <Text className="count">{content.length}/{MAX_CONTENT}</Text>
      </View>

      <View className="field-block">
        <Text className="field-label">联系方式（选填）</Text>
        <Text className="field-hint">微信号 / 手机号 / 邮箱，最多 {MAX_CONTACT} 字</Text>
        <Input
          className="input"
          value={contact}
          maxlength={MAX_CONTACT}
          placeholder="可不填"
          onInput={(e) => setContact(e.detail.value)}
        />
      </View>

      <View
        className={`btn-submit ${submitting ? "btn-submit-disabled" : ""}`}
        onClick={() => !submitting && void onSubmit()}
      >
        <Text className="btn-submit-text">{submitting ? "提交中…" : "提交反馈"}</Text>
      </View>
    </View>
  );
}
