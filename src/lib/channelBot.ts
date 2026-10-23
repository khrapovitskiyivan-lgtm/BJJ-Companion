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

  // Хэштеги: дописываем только отсутствующие. Правка вызовет edited_channel_post,
  // но там тегов уже не будет не хватать — цикла нет.
  if (!text || !ids.length) return;
  const miss = missingTags(text, ids, TECH_BY_ID);
  if (!miss.length) return;
  const sep = /#\S+\s*$/.test(text) ? " " : "\n\n";
  const next = text + sep + miss.join(" ");
  if (next.length > (isCaption ? 1024 : 4096)) return; // лимиты Telegram
  // разметка сохраняется: дописываем в конец, смещения существующих entities не меняются
  const body = isCaption
    ? { chat_id: post.chat?.id, message_id: post.message_id, caption: next, caption_entities: post.caption_entities ?? [] }
    : { chat_id: post.chat?.id, message_id: post.message_id, text: next, entities: post.entities ?? [] };
  await fetch(`https://api.telegram.org/bot${token}/${isCaption ? "editMessageCaption" : "editMessageText"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
