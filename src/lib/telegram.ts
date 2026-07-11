// === Telegram Mini App интеграция ===
// SDK-скрипт подключён в __root.tsx. Вне Telegram window.Telegram.WebApp либо
// отсутствует, либо отдаёт пустой initData — весь код ниже это безопасно переживает.
import type { StyleProfile } from "./bjj/types";

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

interface TgWebApp {
  ready(): void;
  expand(): void;
  initData: string;
  initDataUnsafe?: { user?: TgUser };
  colorScheme?: "light" | "dark";
  onEvent?(event: string, cb: () => void): void;
}

export function getTelegram(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null;
}

// Настоящее окружение Telegram (а не просто загруженный скрипт в браузере)
export function isTelegram(): boolean {
  const tg = getTelegram();
  return !!tg && typeof tg.initData === "string" && tg.initData.length > 0;
}

// Инициализация: ready/expand + вытаскиваем имя, фото и язык пользователя.
// Тему НЕ трогаем — ей управляет тумблер в шапке (чтобы не конфликтовать).
export function initTelegram(apply: (patch: Partial<StyleProfile>) => void): void {
  const tg = getTelegram();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
  } catch {
    /* ignore */
  }

  const u = tg.initDataUnsafe?.user;
  if (!u) return;

  const patch: Partial<StyleProfile> = {};
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  if (name) patch.name = name;
  if (u.photo_url) patch.avatarUrl = u.photo_url;
  if (u.language_code === "en") patch.locale = "en";

  if (Object.keys(patch).length) apply(patch);
}
