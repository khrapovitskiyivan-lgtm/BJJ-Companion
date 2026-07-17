import { getTelegram, isTelegram } from "../telegram";
import { STYLE_META } from "./constants";
import { STAT_META, ARCHETYPE_STATS } from "./stats";
import type { StyleScore } from "./styleProfile";
import type { Frequency } from "./types";

// Шеринг в Telegram: текстовые карточки (стиль, итог недели) через штатный
// выбор чата t.me/share/url (Bot API 6.1+, инлайн-режим бота не нужен).
// В браузере Web Share API, фоллбэк — копирование в буфер.
// Содержимое дневника (техники, заметки) в текст не попадает.

export const BOT_LINK = "https://t.me/companionminiapp_bot";

// Текст карточки стиля: топ-архетип + прогресс
export function buildStyleShare(top: StyleScore, doneCount: number, total: number): string {
  const stat = STAT_META[ARCHETYPE_STATS[top.style].primary].ru;
  return (
    `Мой стиль в BJJ: ${STYLE_META[top.style].ru} (${top.pct}% игры), ` +
    `ключевой стат: ${stat}. Изучено ${doneCount} из ${total} техник. Определи свой:`
  );
}

// Текст итога недели: с частотой — план и серия, без — просто счёт
export function buildWeekShare(done: number, quota: Frequency | undefined, weekStreak: number): string {
  if (!quota) {
    return `Тренировок BJJ на этой неделе: ${done}. Веду дневник тут:`;
  }
  const base = done >= quota ? `Неделя в плане: ${done} из ${quota} тренировок` : `Неделя: ${done} из ${quota} тренировок`;
  const streak = weekStreak > 1 ? `, серия ${weekStreak} нед. подряд` : "";
  return `${base}${streak}. Веду дневник BJJ тут:`;
}

// Отправка: Telegram — выбор чата, браузер — Web Share, фоллбэк — буфер.
// Возвращает "tg" | "share" | "copied" | null (для тоста «Скопировано»).
export async function shareText(text: string): Promise<"tg" | "share" | "copied" | null> {
  if (typeof window === "undefined") return null;
  const url = `https://t.me/share/url?url=${encodeURIComponent(BOT_LINK)}&text=${encodeURIComponent(text)}`;
  const tg = getTelegram();
  if (isTelegram() && tg?.openTelegramLink) {
    try {
      tg.openTelegramLink(url);
      return "tg";
    } catch {
      /* дальше по фоллбэкам */
    }
  }
  const full = `${text} ${BOT_LINK}`;
  if (navigator.share) {
    try {
      await navigator.share({ text: full });
      return "share";
    } catch {
      return null; // пользователь закрыл системный диалог — не считаем ошибкой
    }
  }
  try {
    await navigator.clipboard.writeText(full);
    return "copied";
  } catch {
    return null;
  }
}
