import { View, Text, Image } from "@tarojs/components";
import type { PlazaFeedItem } from "../../services/plaza";
import "./index.scss";

export type PlazaFeedCardProps = {
  item: PlazaFeedItem;
  /** 搜索页等展示作者头像与昵称 */
  showAuthor?: boolean;
  onNavigateDetail?: (id: number) => void;
};

function formatBookTitleWithGuillemets(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("《") && t.endsWith("》") && t.length >= 4) return t;
  const inner = t.replace(/^[《\s]+/u, "").replace(/[》\s]+$/u, "").trim();
  if (!inner) return null;
  return `《${inner}》`;
}

function formatEntryDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${day}日 ${hh}:${mm}`;
}

function excerptPreviewText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function PlazaFeedCard({ item, showAuthor = false, onNavigateDetail }: PlazaFeedCardProps) {
  const bookLabel =
    formatBookTitleWithGuillemets(item.book_title) ?? item.book_title ?? "";
  const preview = excerptPreviewText(item.content);
  const dateStr = formatEntryDateTime(item.created_at);
  const name = item.author.nickname?.trim() || "书友";
  const letter = name.slice(0, 1);
  const likeCount = item.likeCount ?? 0;
  const saveCount = item.saveCount ?? 0;

  return (
    <View
      className="plaza-feed-card"
      onClick={() => onNavigateDetail?.(item.id)}
    >
      {showAuthor ? (
        <View className="plaza-feed-card__author">
          {item.author.avatarUrl ? (
            <Image
              className="plaza-feed-card__avatar"
              src={item.author.avatarUrl}
              mode="aspectFill"
            />
          ) : (
            <View className="plaza-feed-card__avatar plaza-feed-card__avatar--placeholder">
              <Text className="plaza-feed-card__avatar-letter">{letter}</Text>
            </View>
          )}
          <Text className="plaza-feed-card__name">{name}</Text>
        </View>
      ) : null}

      {bookLabel ? <Text className="plaza-feed-card__book">{bookLabel}</Text> : null}
      <Text className="plaza-feed-card__text">{preview}</Text>

      <View className="plaza-feed-card__footer">
        <Text className="plaza-feed-card__time">{dateStr}</Text>
        <View className="plaza-feed-card__stats">
          <Text className="plaza-feed-card__stat">点赞 {likeCount}</Text>
          <Text className="plaza-feed-card__stat">收藏 {saveCount}</Text>
        </View>
      </View>
    </View>
  );
}
