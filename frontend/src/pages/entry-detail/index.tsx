import { View, Text, Image, Button, Textarea, Switch } from "@tarojs/components";
import Taro, { useLoad, useReady, useShareAppMessage } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { ensureLogin } from "../../services/auth";
import { requestIndexListRefresh } from "../../services/indexListRefreshFlag";
import { SharePosterModal } from "../../components/share-poster-modal";
import { API_BASE } from "../../config";
import {
  deleteEntry,
  fetchEntryDetail,
  interpretEntry,
  toggleEntryLike,
  toggleEntrySave,
  updateEntry,
  type EntryInteraction,
  type EntryVisibility,
  type Interpretation,
} from "../../services/entries";
import { entryDetailIcons } from "../../assets/entry-detail-icons";
import "./index.scss";

type SharePayload = { id: number; bookTitle: string | null; content: string };

/** 新版单段存储在 summary；旧版三段合并展示 */
function interpretationDisplayBody(it: Interpretation): string {
  const s = it.summary.trim();
  const r = it.resonance.trim();
  const q = it.reflection_question.trim();
  if (s && !r && !q) return s;
  return [s, r, q].filter(Boolean).join("\n\n");
}

/**
 * 胶囊（菜单按钮）下沿与自定义顶栏区域底边之间的留白（物理 px）。
 * 若此处为 0，顶栏总高 = menuButton.bottom，底边与胶囊底边同一条线，看起来会「完全贴住」。
 * 原生导航条与胶囊之间通常仍有空隙，故默认留一点。
 */
const NAV_GAP_BELOW_CAPSULE_PX = 8;

export default function EntryDetailPage() {
  const [id, setId] = useState(0);
  const [content, setContent] = useState("");
  const [bookTitle, setBookTitle] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
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
  const [interpreting, setInterpreting] = useState(false);
  const [visibility, setVisibility] = useState<EntryVisibility>("private");
  const [plazaSaving, setPlazaSaving] = useState(false);
  /** 他人浏览公开摘录：点赞/收藏 */
  const [interaction, setInteraction] = useState<EntryInteraction | null>(null);
  /** 本人查看自己的公开摘录：他人点赞数 / 收藏人数 */
  const [publicStats, setPublicStats] = useState<{ likeCount: number; saveCount: number } | null>(
    null
  );
  const [interactionBusy, setInteractionBusy] = useState(false);
  /** 键盘高度（px），用于 fixed 底部弹层上移，避免遮挡输入框（需关闭 textarea adjustPosition） */
  const [noteKeyboardPx, setNoteKeyboardPx] = useState(0);
  /**
   * 自定义顶栏布局（px）：
   * topTotalPx = 胶囊 bottom + NAV_GAP_BELOW_CAPSULE_PX（顶栏略长于胶囊下沿，才有「缝」）；
   * navRowPx = topTotalPx - statusBarPx。
   */
  const [navLayout, setNavLayout] = useState({
    topTotalPx: 88 + NAV_GAP_BELOW_CAPSULE_PX,
    statusBarPx: 20,
    navRowPx: 44 + NAV_GAP_BELOW_CAPSULE_PX,
  });

  const shareRef = useRef<SharePayload>({ id: 0, bookTitle: null, content: "" });
  const latestEntryIdRef = useRef(0);

  useEffect(() => {
    latestEntryIdRef.current = id;
  }, [id]);

  useReady(() => {
    try {
      const sys = Taro.getSystemInfoSync();
      const sb = typeof sys.statusBarHeight === "number" ? sys.statusBarHeight : 20;
      const mb = Taro.getMenuButtonBoundingClientRect();
      const topTotalPx = mb.bottom + NAV_GAP_BELOW_CAPSULE_PX;
      const navRowPx = Math.max(0, topTotalPx - sb);
      setNavLayout({ topTotalPx, statusBarPx: sb, navRowPx });
    } catch {
      const sb = 20;
      const navRowPx = 44 + NAV_GAP_BELOW_CAPSULE_PX;
      setNavLayout({ topTotalPx: sb + navRowPx, statusBarPx: sb, navRowPx });
    }
  });

  useEffect(() => {
    const wxMini = (
      globalThis as unknown as {
        wx?: {
          onKeyboardHeightChange?: (cb: (res: { height?: number }) => void) => void;
          offKeyboardHeightChange?: (cb: (res: { height?: number }) => void) => void;
        };
      }
    ).wx;
    if (!wxMini?.onKeyboardHeightChange) return;
    const handler = (res: { height?: number }) => {
      setNoteKeyboardPx(res.height ?? 0);
    };
    wxMini.onKeyboardHeightChange(handler);
    return () => {
      wxMini.offKeyboardHeightChange?.(handler);
    };
  }, []);

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
    let title = "InkMind·摘录";
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
    setInterpretation(res.interpretation);
    setUserNote(res.entry.note ?? "");
    setVisibility(res.entry.visibility ?? "private");
    setInteraction(res.interaction ?? null);
    setPublicStats(res.publicStats ?? null);
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
    if (!id || interpreting) return;
    if (!isEntryOwner) {
      Taro.showToast({ title: "仅作者本人可生成 AI 解读", icon: "none" });
      return;
    }
    try {
      setInterpreting(true);
      await ensureLogin();
      const res = await interpretEntry(id);
      setInterpretation(res.interpretation);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setInterpreting(false);
    }
  };

  const openNoteModal = () => {
    if (!isEntryOwner) return;
    setNoteDraft(userNote);
    setNoteKeyboardPx(0);
    setNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    setNoteKeyboardPx(0);
    setNoteModalOpen(false);
  };

  const onToggleLike = async () => {
    if (!id || !interaction || interactionBusy) return;
    try {
      await ensureLogin();
      setInteractionBusy(true);
      const r = await toggleEntryLike(id);
      setInteraction((prev) => ({
        likeCount: r.likeCount,
        saveCount: prev?.saveCount ?? 0,
        likedByMe: r.liked,
        savedByMe: prev?.savedByMe ?? false,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setInteractionBusy(false);
    }
  };

  const onToggleSave = async () => {
    if (!id || !interaction || interactionBusy) return;
    try {
      await ensureLogin();
      setInteractionBusy(true);
      const r = await toggleEntrySave(id);
      setInteraction((prev) =>
        prev ? { ...prev, savedByMe: r.saved, saveCount: r.saveCount } : null
      );
      Taro.showToast({ title: r.saved ? "已加入收藏" : "已取消收藏", icon: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setInteractionBusy(false);
    }
  };

  const onPlazaVisibilityChange = async (checked: boolean) => {
    if (!id || !isEntryOwner || plazaSaving) return;
    const next: EntryVisibility = checked ? "public" : "private";
    try {
      await ensureLogin();
      setPlazaSaving(true);
      await updateEntry(id, { visibility: next });
      setVisibility(next);
      Taro.showToast({ title: checked ? "已设为公开" : "已设为仅自己可见", icon: "success" });
      await loadDetail(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setPlazaSaving(false);
    }
  };

  const saveNoteFromModal = async () => {
    if (!id || !isEntryOwner) return;
    try {
      await ensureLogin();
      setNoteSaving(true);
      const trimmed = noteDraft.trim().slice(0, 500);
      await updateEntry(id, { note: trimmed.length ? trimmed : null });
      setUserNote(trimmed);
      closeNoteModal();
      Taro.showToast({ title: "已保存", icon: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      Taro.showToast({ title: msg, icon: "none" });
    } finally {
      setNoteSaving(false);
    }
  };

  const onDelete = () => {
    if (!id || !isEntryOwner) return;
    void Taro.showModal({
      title: "删除收藏？",
      content: "删除后无法恢复",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await ensureLogin();
          await deleteEntry(id);
          requestIndexListRefresh();
          Taro.showToast({ title: "已删除", icon: "success" });
          setTimeout(() => Taro.switchTab({ url: "/pages/index/index" }), 400);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "删除失败";
          Taro.showToast({ title: msg, icon: "none" });
        }
      },
    });
  };

  const onNavBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      void Taro.navigateBack();
    } else {
      void Taro.switchTab({ url: "/pages/index/index" });
    }
  };

  return (
    <View
      className="page page-entry-detail"
      style={{ paddingTop: `${navLayout.topTotalPx}px` }}
    >
      <View
        className="custom-navbar"
        style={{
          height: `${navLayout.topTotalPx}px`,
          paddingTop: `${navLayout.statusBarPx}px`,
        }}
      >
        <View className="custom-navbar-inner" style={{ height: `${navLayout.navRowPx}px` }}>
          <View className="custom-nav-back" onClick={onNavBack}>
            <Image className="custom-nav-back-img" src={entryDetailIcons.back} mode="aspectFit" />
          </View>
          <Text className="custom-nav-title">详情</Text>
        </View>
      </View>

      <View className="page-main">
        {bookTitle ? (
          <View className="card card-book">
            <Text className="card-kicker">书名</Text>
            <Text className="book-title-text">{bookTitle}</Text>
          </View>
        ) : null}

        <View className="card card-quote">
          <Text className="card-kicker">正文</Text>
          <Text className="quote-body">{content || "…"}</Text>
        </View>

        {isEntryOwner ? (
          <View className="card card-plaza">
            <View className="plaza-row">
              <View className="plaza-copy">
                <Text className="card-kicker">是否公开</Text>
                <Text className="plaza-status">
                  {visibility === "public"
                    ? "当前：公开（广场可见）"
                    : visibility === "unlisted"
                      ? "当前：仅链接可见"
                      : "当前：仅自己可见"}
                </Text>
                <Text className="plaza-hint">
                  打开开关后摘录正文会对他人可见并出现在广场；你的随记始终仅自己可见。
                </Text>
                {visibility === "public" && publicStats ? (
                  <View className="plaza-stats-row">
                    <Text className="plaza-stats-item">点赞 {publicStats.likeCount}</Text>
                    <Text className="plaza-stats-sep">·</Text>
                    <Text className="plaza-stats-item">收藏 {publicStats.saveCount}</Text>
                  </View>
                ) : null}
              </View>
              <Switch
                checked={visibility === "public"}
                color="#38a8ff"
                disabled={plazaSaving}
                onChange={(e) => void onPlazaVisibilityChange(Boolean(e.detail.value))}
              />
            </View>
          </View>
        ) : null}

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
          <View className="ai-title-row">
            <Text className="card-kicker ai-title-kicker">AI解读</Text>
            <Text className="ai-disclaimer">内容 AI 生成，仅供参考</Text>
          </View>
          {interpretation ? (
            <Text className="inter-companion">{interpretationDisplayBody(interpretation)}</Text>
          ) : interpreting ? (
            <View className="inter-loading">
              <View className="inter-loading-head">
                <View className="inter-loading-dots">
                  <View className="inter-loading-dot" />
                  <View className="inter-loading-dot" />
                  <View className="inter-loading-dot" />
                </View>
                <Text className="inter-loading-caption">正在生成解读，请稍候</Text>
              </View>
              <View className="inter-loading-skeleton">
                <View className="inter-sk-line" />
                <View className="inter-sk-line inter-sk-line-mid" />
                <View className="inter-sk-line inter-sk-line-short" />
              </View>
            </View>
          ) : (
            <Text className="inter-placeholder">还没有陪伴文字，点击下方生成一段。</Text>
          )}
        </View>
      </View>

      {isEntryOwner ? (
        <View className="actions">
          <View
            className={`btn primary ${interpreting ? "primary-loading" : ""}`}
            onClick={() => !interpreting && void onInterpret()}
          >
            {interpreting ? (
              <View className="btn-loading-row">
                <Text className="btn-primary-text">解读中</Text>
                <View className="btn-loading-dots">
                  <View className="btn-loading-dot" />
                  <View className="btn-loading-dot" />
                  <View className="btn-loading-dot" />
                </View>
              </View>
            ) : (
              <Text className="btn-primary-text">
                {interpretation ? "重新解读" : "生成解读"}
              </Text>
            )}
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
      ) : (
        <View className="actions actions-visitor">
          {interaction ? (
            <View className="visitor-chips">
              <View
                className={`visitor-chip visitor-chip-like ${interaction.likedByMe ? "visitor-chip--on" : ""} ${interactionBusy ? "visitor-chip--busy" : ""}`}
                onClick={() => void onToggleLike()}
              >
                <Image
                  className="visitor-chip-icon"
                  src={interaction.likedByMe ? entryDetailIcons.heartFilled : entryDetailIcons.heartOutline}
                  mode="aspectFit"
                />
                <Text className="visitor-chip-label">{interaction.likeCount}</Text>
              </View>
              <View
                className={`visitor-chip visitor-chip-save ${interaction.savedByMe ? "visitor-chip--on" : ""} ${interactionBusy ? "visitor-chip--busy" : ""}`}
                onClick={() => void onToggleSave()}
              >
                <Image
                  className="visitor-chip-icon"
                  src={interaction.savedByMe ? entryDetailIcons.bookmarkFilled : entryDetailIcons.bookmarkOutline}
                  mode="aspectFit"
                />
                <Text className="visitor-chip-label">{interaction.saveCount ?? 0}</Text>
              </View>
            </View>
          ) : (
            <View className="visitor-chips visitor-chips--placeholder" />
          )}
          <View className="actions-side">
            <Button className="btn-icon btn-share-open" onClick={() => setPosterModalOpen(true)}>
              <Image className="btn-icon-img" src={entryDetailIcons.share} mode="aspectFit" />
            </Button>
          </View>
        </View>
      )}

      {noteModalOpen ? (
        <View className="note-modal-mask" onClick={closeNoteModal}>
          <View
            className="note-modal-panel"
            style={
              noteKeyboardPx > 0 ? { transform: `translateY(-${noteKeyboardPx}px)` } : undefined
            }
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="note-modal-title">编辑随记</Text>
            <Text className="note-modal-sub">最多 500 字，保存后展示在详情里</Text>
            <Textarea
              className="note-modal-textarea"
              value={noteDraft}
              maxlength={500}
              focus
              adjustPosition={false}
              cursorSpacing={24}
              showConfirmBar={false}
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
