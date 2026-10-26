// Серверная часть: новые и отредактированные посты Telegram-канала тренера.
// Вебхук бота (админ канала) получает channel_post / edited_channel_post:
// 1) распознаём техники (хэштеги + названия), 2) сохраняем пост в Supabase —
// приложение покажет его на карточках техник, 3) дописываем недостающие хэштеги.
// Только для сервера (сервисный ключ, токен бота) — в клиентский бандл не тянуть.
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { buildChannelIndex, matchCaption, missingTags, type ChannelIndex } from "@/lib/bjj/channelTag";

export interface TgChannelPost {
  message_id: number;
  media_group_id?: string;
  date: number;
  chat?: { id?: number; username?: string };
  text?: string;
  caption?: string;
  entities?: unknown[];
  caption_entities?: unknown[];
  video?: unknown;
}

const CHANNEL = (process.env.TG_CHANNEL_USERNAME ?? "myownbjj").toLowerCase();
let index: ChannelIndex | null = null;
// строка под каждым видео канала: ведёт подписчиков в приложение
export const APP_MENTION = "@companionminiapp_bot";
export const APP_LINE = `Все техники и дневник тренировок: ${APP_MENTION}`;

async function rpc(fn: string, body: Record<string, unknown>): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.ok;
}

export async function handleChannelPost(post: TgChannelPost, token: string): Promise<void> {
  if ((post.chat?.username ?? "").toLowerCase() !== CHANNEL) return; // только свой канал
  index ??= buildChannelIndex(TECHNIQUES);

  const isCaption = post.caption !== undefined;
  const text = post.caption ?? post.text ?? "";
  const ids = text ? matchCaption(text, index).ids : [];

  await rpc("bjj_channel_upsert", {
    p_msg: post.message_id,
    p_group: post.media_group_id ?? null,
    p_caption: text || null,
    p_has_video: !!post.video,
    p_techniques: ids,
    p_posted_at: new Date(post.date * 1000).toISOString(),
  });

  // Хэштеги: дописываем только отсутствующие; под видео строка со ссылкой на приложение.
  // Правка вызовет edited_channel_post, но там уже ничего не будет не хватать — цикла нет.
  if (!text) return;
  // старые посты размечены вручную: теги дописываем только к свежим (иначе массовая правка
  // ссылкой разбудит распознавание по тексту на сотнях старых подписей)
  const fresh = Date.now() / 1000 - post.date < 14 * 86400;
  const miss = fresh && ids.length ? missingTags(text, ids, TECH_BY_ID) : [];
  const needLink = !!post.video && !text.includes(APP_MENTION);
  if (!miss.length && !needLink) return;
  // строка-ссылка всегда последней: снимаем её, дописываем теги, возвращаем
  const base = text.endsWith(APP_LINE) ? text.slice(0, -APP_LINE.length).trimEnd() : text;
  let next = miss.length ? base + (/#\S+\s*$/.test(base) ? " " : "\n\n") + miss.join(" ") : base;
  if (!next.includes(APP_MENTION) || base !== text) next += "\n\n" + APP_LINE;
  if (next === text) return;
  if (next.length > (isCaption ? 1024 : 4096)) return; // лимиты Telegram
  // разметка сохраняется: дописываем в конец, смещения entities в оставшемся тексте не меняются
  const keep = (e: unknown[] | undefined) =>
    (e ?? []).filter((x) => {
      const { offset, length } = x as { offset: number; length: number };
      return offset + length <= base.length;
    });
  const body = isCaption
    ? { chat_id: post.chat?.id, message_id: post.message_id, caption: next, caption_entities: keep(post.caption_entities) }
    : { chat_id: post.chat?.id, message_id: post.message_id, text: next, entities: keep(post.entities) };
  await fetch(`https://api.telegram.org/bot${token}/${isCaption ? "editMessageCaption" : "editMessageText"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
