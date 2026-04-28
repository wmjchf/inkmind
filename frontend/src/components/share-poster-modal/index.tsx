import { Canvas, View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";
import { entryDetailIcons } from "../../assets/entry-detail-icons";
import { API_BASE, SHARE_BASE_URL } from "../../config";
import "./index.scss";

type SharePosterModalProps = {
  open: boolean;
  entryId: number;
  bookTitle: string | null;
  content: string;
  sourceImageUrl?: string | null;
  /** 详情页预拉取的小程序码本地路径，有则不再在弹层打开时重复下载 */
  prefetchedWxacodePath?: string;
  onClose: () => void;
};

const CANVAS_ID = "export-canvas";
/** 逻辑尺寸（与弹层视觉比例一致）；旧版 Canvas 上勿改原生 width/height + scale，易错位裁切 */
const CANVAS_W = 375;
const CANVAS_H = 640;
/** 仅放大导出 PNG 像素（插值），比 3 略清晰且布局稳定 */
const EXPORT_DEST_SCALE = 4;

const drawWrappedTextCenter = (
  ctx: Taro.CanvasContext,
  text: string,
  centerX: number,
  startY: number,
  maxUnitsPerLine: number,
  lineHeight: number,
  maxLines: number
) => {
  const chars = text.trim().replace(/\s+/g, " ").split("");
  const lines: string[] = [];
  let line = "";
  let units = 0;
  const unitOf = (ch: string) => (/[^\x00-\xff]/.test(ch) ? 2 : 1);

  for (const ch of chars) {
    const nextLine = `${line}${ch}`;
    const nextUnits = units + unitOf(ch);
    if (nextUnits <= maxUnitsPerLine) {
      line = nextLine;
      units = nextUnits;
      continue;
    }
    if (line) lines.push(line);
    line = ch;
    units = unitOf(ch);
  }
  if (line) lines.push(line);

  const finalLines = lines.slice(0, maxLines).map((item, idx) => {
    if (idx !== maxLines - 1 || lines.length <= maxLines) return item;
    const arr = item.split("");
    let used = 0;
    let result = "";
    for (const c of arr) {
      const u = unitOf(c);
      if (used + u > maxUnitsPerLine - 2) break;
      result += c;
      used += u;
    }
    return `${result}…`;
  });

  ctx.setTextAlign("center");
  finalLines.forEach((item, idx) => {
    ctx.fillText(item, centerX, startY + idx * lineHeight);
  });
  ctx.setTextAlign("left");
  return startY + finalLines.length * lineHeight;
};

/** 圆角矩形路径（用于 clip / fill），与小程序 CanvasContext.arcTo 一致 */
const roundRectPath = (
  ctx: Taro.CanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

export function SharePosterModal(props: SharePosterModalProps) {
  const { open, entryId, bookTitle, content, onClose, prefetchedWxacodePath = "" } = props;
  const [saving, setSaving] = useState(false);
  /** 小程序码本地临时路径；失败时为空，用网页二维码兜底 */
  const [wxacodePath, setWxacodePath] = useState("");

  const mainQuote = content.trim() || "在 InkMind，记录触动你的句子。";
  const attribution = bookTitle?.trim()
    ? `——《${bookTitle.trim()}》`
    : "—— InkMind";
  const base = SHARE_BASE_URL.replace(/\/$/, "");
  const shareUrl = `${base}/pages/entry-detail/index?id=${entryId}`;
  const webQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;

  useEffect(() => {
    setWxacodePath("");
  }, [entryId]);

  useEffect(() => {
    if (!open || !entryId) {
      if (!open) setWxacodePath("");
      return;
    }
    if (prefetchedWxacodePath) return;
    setWxacodePath("");
    const token = Taro.getStorageSync("accessToken") as string | undefined;
    if (!token) return;

    void Taro.downloadFile({
      url: `${API_BASE}/entries/${entryId}/wxacode`,
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) {
          setWxacodePath(res.tempFilePath);
        }
      },
    });
  }, [open, entryId, prefetchedWxacodePath]);

  const displayQrSrc = prefetchedWxacodePath || wxacodePath || webQrUrl;

  const downloadQrForCanvas = async (): Promise<string> => {
    if (prefetchedWxacodePath) return prefetchedWxacodePath;
    if (wxacodePath) return wxacodePath;
    const token = Taro.getStorageSync("accessToken") as string | undefined;
    if (token && entryId) {
      const r = await Taro.downloadFile({
        url: `${API_BASE}/entries/${entryId}/wxacode`,
        header: { Authorization: `Bearer ${token}` },
      });
      if (r.statusCode === 200 && r.tempFilePath) return r.tempFilePath;
    }
    const w = await Taro.downloadFile({ url: webQrUrl });
    if (w.statusCode !== 200) throw new Error("二维码下载失败");
    return w.tempFilePath;
  };

  const savePoster = async () => {
    if (saving) return;
    setSaving(true);
    Taro.showLoading({ title: "正在导出..." });

    try {
      const qrTemp = await downloadQrForCanvas();

      const ctx = Taro.createCanvasContext(CANVAS_ID);

      ctx.setFillStyle("#f4faff");
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.setStrokeStyle("rgba(56, 168, 255, 0.07)");
      ctx.setLineWidth(1);
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(40 + i * 48, 120 + (i % 3) * 80, 80 + i * 12, 0, Math.PI * 1.2);
        ctx.stroke();
      }

      ctx.setFillStyle("#38a8ff");
      ctx.setFontSize(17);
      const quoteEndY = drawWrappedTextCenter(ctx, mainQuote, CANVAS_W / 2, 100, 26, 30, 8);

      ctx.setFontSize(15);
      ctx.setTextAlign("center");
      ctx.fillText(attribution, CANVAS_W / 2, quoteEndY + 36);
      ctx.setTextAlign("left");

      const footerY = CANVAS_H - 200;
      ctx.setFillStyle("#38a8ff");
      ctx.setFontSize(12);
      ctx.setTextAlign("center");
      ctx.fillText("Do not go gentle into that good night.", CANVAS_W / 2, footerY);
      ctx.setFontSize(11);
      ctx.fillText("* · · · · · · · · · · · · *", CANVAS_W / 2, footerY + 28);
      ctx.setFontSize(20);
      ctx.fillText("&", CANVAS_W / 2, footerY + 58);
      ctx.setTextAlign("left");

      const qrImgSide = 72;
      const qrPad = 6;
      const qrRadius = 10;
      const qrOuter = qrImgSide + qrPad * 2;
      const qrRight = CANVAS_W - 28;
      const qrLeft = qrRight - qrOuter;
      const qrBottomMargin = 28;
      const qrTop = CANVAS_H - qrBottomMargin - qrOuter;

      ctx.setFillStyle("#ffffff");
      roundRectPath(ctx, qrLeft, qrTop, qrOuter, qrOuter, qrRadius);
      ctx.fill();

      ctx.save();
      roundRectPath(ctx, qrLeft, qrTop, qrOuter, qrOuter, qrRadius);
      ctx.clip();
      ctx.drawImage(qrTemp, qrLeft + qrPad, qrTop + qrPad, qrImgSide, qrImgSide);
      ctx.restore();

      await new Promise<void>((resolve) => ctx.draw(false, resolve));

      const res = await Taro.canvasToTempFilePath({
        canvasId: CANVAS_ID,
        destWidth: CANVAS_W * EXPORT_DEST_SCALE,
        destHeight: CANVAS_H * EXPORT_DEST_SCALE,
        fileType: "png",
        quality: 1,
      });

      await Taro.saveImageToPhotosAlbum({ filePath: res.tempFilePath });
      onClose();
      Taro.showToast({ title: "已保存到相册", icon: "success" });
    } catch (e) {
      console.error(e);
      Taro.showToast({ title: "保存失败", icon: "none" });
    } finally {
      setSaving(false);
      Taro.hideLoading();
    }
  };

  if (!open) return null;

  return (
    <View className="poster-mask" onClick={onClose}>
      <View className="poster-panel" onClick={(e) => e.stopPropagation()}>
        <View className="poster-html poster-surface">
          <View className="poster-pattern" />

          <View className="poster-body">
            <View className="poster-quote-block">
              <Text className="poster-main-quote">{mainQuote}</Text>
              <Text className="poster-attribution">{attribution}</Text>
            </View>

            <View className="poster-spacer" />

            <View className="poster-bottom">
              <Text className="poster-en-line">Do not go gentle into that good night.</Text>
              <Text className="poster-divider">* · · · · · · · · · · · · *</Text>
              <Text className="poster-ampersand">&</Text>
            </View>
          </View>

          <View className="poster-qr-corner">
            <View className="poster-qr-img-shell">
              <Image src={displayQrSrc} className="poster-qr-img" mode="aspectFit" />
            </View>
          </View>
        </View>

        <View className="poster-actions">
          <View className="btn-download" onClick={() => void savePoster()}>
            <Text className="btn-text">{saving ? "导出中…" : "保存海报到相册"}</Text>
          </View>
          <View className="poster-close-wrap" onClick={onClose}>
            <Image className="poster-close-icon" src={entryDetailIcons.close} mode="aspectFit" />
          </View>
        </View>

        <Canvas canvasId={CANVAS_ID} className="canvas-hide" style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }} />
      </View>
    </View>
  );
}
