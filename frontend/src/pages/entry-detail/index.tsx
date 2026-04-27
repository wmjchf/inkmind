import { View, Text, Image, Button, Textarea } from "@tarojs/components";
import Taro, { useLoad, useShareAppMessage } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { ensureLogin } from "../../services/auth";
import { SharePosterModal } from "../../components/share-poster-modal";
import { API_BASE } from "../../config";
import {
  deleteEntry,
  fetchEntryDetail,
  interpretEntry,
  updateEntry,
  type Interpretation,
} from "../../services/entries";
import { entryDetailIcons } from "../../assets/entry-detail-icons";
import "./index.scss";

type SharePayload = { id: number; bookTitle: string | null; content: string };

export default function EntryDetailPage() {
  const [id, setId] = useState(0);
  const [content, setContent] = useState("");
  const [bookTitle, setBookTitle] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [userNote, setUserNote] = useState("");
  /** 当前用户是否为该条摘录作者；他人从分享进入时为 false */
  const [isEntryOwner, setIsEntryOwner] = useState(true);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  /** 进入详情后预拉取的小程序码临时路径，供分享海报直接使用 */
  const [shareWxacodePath, setShareWxacodePath] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const shareRef = useRef<SharePayload>({ id: 0, bookTitle: null, content: "" });
  const latestEntryIdRef = useRef(0);

  useEffect(() => {
    latestEntryIdRef.current = id;
  }, [id]);

  const prefetchWxacode = (entryId: number) => {
    const token = Taro.getStorageSync("accessToken") as string | undefined;
    if (!token || !entryId) return;
    void Taro.downloadFile({
      url: `${API_BASE}/entries/${entryId}/wxacode`,
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        if (latestEntryIdRef.current !== entryId) return;
        if (res.statusCode === 200 && res.tempFilePath) setShareWxacodePath(res.tempFilePath);
      },
    });
  };

  useShareAppMessage(() => {
    const { id: sid, bookTitle: bt, content: c } = shareRef.current;
    const path = `/pages/entry-detail/index?id=${sid}`;
    const t = bt?.trim();
    let title = "InkMind 摘录";
    if (t) title = `「${t}」`;
    else {
      const raw = c.trim();
      if (raw) title = raw.length > 30 ? `${raw.slice(0, 30)}…` : raw;
    }
    return { title, path };
  });

  const loadDetail = async (entryId: number) => {
    await ensureLogin();
    const res = await fetchEntryDetail(entryId);
    shareRef.current = {
      id: entryId,
      bookTitle: res.entry.book_title,
      content: res.entry.content,
    };
    setContent(res.entry.content);
    setBookTitle(res.entry.book_title);
    setSourceImageUrl(res.entry.source_image_url);
    setTags(res.entry.tags || []);
    setInterpretation(res.interpretation);
    setUserNote(res.entry.note ?? "");
    /* 旧接口无 is_owner 时视为本人，避免误伤 */
    setIsEntryOwner(res.is_owner !== false);
  };

  useLoad(async (q) => {
    const routerParams = Taro.getCurrentInstance().router?.params || {};
    const idFromQuery = q.id ?? routerParams.id;
    const sceneRaw = q.scene ?? routerParams.scene;
    let entryId = 0;
    if (idFromQuery !== undefined && idFromQuery !== null && String(idFromQuery).length) {
      const n = parseInt(String(idFromQuery), 10);
      if (Number.isFinite(n) && n > 0) entryId = n;
    }
    if (!entryId && sceneRaw !== undefined && sceneRaw !== null && String(sceneRaw).length) {
      try {
        const decoded = decodeURIComponent(String(sceneRaw).trim());
        const n = parseInt(decoded.replace(/^e/i, ""), 10);
        if (Number.isFinite(n) && n > 0) entryId = n;
      } catch {
        /* ignore */
      }
    }
    setId(entryId);
    latestEntryIdRef.current = entryId;
    setShareWxacodePath("");
    setIsEntryOwner(true);
    shareRef.current.id = entryId;
    if (!entryId) {
      Taro.showToast({ title: "无效条目", icon: "none" });
      return;
    }
    try {
      await loadDetail(entryId);
      prefetchWxacode(entryId);
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

  const openNoteModal = () => {
    if (!isEntryOwner) return;
    setNoteDraft(userNote);
    setNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    setNoteModalOpen(false);
  };

  const saveNoteFromModal = async () => {
    if (!id || !isEntryOwner) return;
    try {
      await ensureLogin();
      setNoteSaving(true);
      const trimmed = noteDraft.trim().slice(0, 500);
      await updateEntry(id, { note: trimmed.length ? trimmed : null });
      setUserNote(trimmed);
      setNoteModalOpen(false);
      Taro.showToast({ title: "已保存", icon: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setNoteSaving(false);
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
      <View className="page-main">
        <View className="ai-hero">
          <Text className="ai-hero-kicker">InkMind · AI</Text>
          <Text className="ai-hero-title">摘录详情</Text>
          <Text className="ai-hero-desc">
            正文与标签来自你的收藏；解读由模型生成，可多次重新生成直至满意。
          </Text>
        </View>

        {bookTitle ? (
          <View className="card card-book">
            <Text className="card-kicker">书名</Text>
            <Text className="book-title-text">{bookTitle}</Text>
          </View>
        ) : null}

        <View className="card card-quote">
          <Text className="card-kicker">正文</Text>
          <Text className="quote-body">{content || "…"}</Text>
          <Text className="card-kicker card-quote-tags-kicker">标签</Text>
          <Text className="tag-line">
            {tags.length ? tags.map((t) => t.name).join("、") : "暂无"}
          </Text>
        </View>

        <View className="card card-note">
          <View className="note-card-head">
            <Text className="card-kicker note-card-kicker">
              {isEntryOwner ? "我的随记" : "作者随笔"}
            </Text>
            {isEntryOwner ? (
              <View className="note-edit-btn" onClick={openNoteModal}>
                <Text className="note-edit-btn-text">编辑</Text>
              </View>
            ) : null}
          </View>
          <Text className="note-hint">
            {isEntryOwner
              ? "写下你对摘录的解读与联想，留作日后回看（选填）"
              : "以下为摘录作者本人留下的随记，仅作者可编辑。"}
          </Text>
          <Text className={`note-display ${userNote.trim() ? "" : "note-display-empty"}`}>
            {userNote.trim()
              ? userNote
              : isEntryOwner
                ? "暂无随记，点击「编辑」添加"
                : "作者暂未填写随记"}
          </Text>
        </View>

        <View className="card card-ai">
          <Text className="card-kicker">AI 解读</Text>
          {interpretation ? (
            <View className="inter-blocks">
              <Text className="inter-label">摘要</Text>
              <Text className="inter-para">{interpretation.summary}</Text>
              <Text className="inter-label">共鸣</Text>
              <Text className="inter-para">{interpretation.resonance}</Text>
              <Text className="inter-label">反思</Text>
              <Text className="inter-reflect">{interpretation.reflection_question}</Text>
            </View>
          ) : (
            <Text className="inter-placeholder">尚未生成解读，点击下方按钮。</Text>
          )}
        </View>
      </View>

      <View className="actions">
        <View className="btn primary" onClick={() => void onInterpret()}>
          <Text className="btn-primary-text">
            {interpretation ? "重新解读" : "生成解读"}
          </Text>
        </View>
        <View className="actions-side">
          <Button className="btn-icon btn-share-open" onClick={() => setPosterModalOpen(true)}>
            <Image className="btn-icon-img" src={entryDetailIcons.share} mode="aspectFit" />
          </Button>
          <View className="btn-icon btn-icon-danger" onClick={onDelete}>
            <Image className="btn-icon-img" src={entryDetailIcons.trash} mode="aspectFit" />
          </View>
        </View>
      </View>

      {noteModalOpen ? (
        <View className="note-modal-mask" onClick={closeNoteModal}>
          <View className="note-modal-panel" onClick={(e) => e.stopPropagation()}>
            <Text className="note-modal-title">编辑随记</Text>
            <Text className="note-modal-sub">最多 500 字，保存后展示在详情里</Text>
            <Textarea
              className="note-modal-textarea"
              value={noteDraft}
              maxlength={500}
              focus
              onInput={(e) => setNoteDraft(e.detail.value)}
            />
            <Text className="note-modal-count">{noteDraft.length}/500</Text>
            <View className="note-modal-actions">
              <View className="note-modal-btn note-modal-btn-cancel" onClick={closeNoteModal}>
                <Text className="note-modal-btn-cancel-text">取消</Text>
              </View>
              <View
                className={`note-modal-btn note-modal-btn-save ${noteSaving ? "note-modal-btn-disabled" : ""}`}
                onClick={() => !noteSaving && void saveNoteFromModal()}
              >
                <Text className="note-modal-btn-save-text">{noteSaving ? "保存中…" : "保存"}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <SharePosterModal
        open={posterModalOpen}
        entryId={id}
        bookTitle={bookTitle}
        content={content}
        sourceImageUrl={sourceImageUrl}
        prefetchedWxacodePath={shareWxacodePath}
        onClose={() => setPosterModalOpen(false)}
      />
    </View>
  );
}
