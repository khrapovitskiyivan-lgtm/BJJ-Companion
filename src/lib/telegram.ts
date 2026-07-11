// === Telegram Mini App интеграция ===
// SDK-скрипт подключён в __root.tsx, но грузится асинхронно — поэтому ждём появления
// window.Telegram.WebApp, прежде чем звать ready()/expand() и читать профиль.
// Вне Telegram всё это безопасно (initData пустой / объекта нет).
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
  isExpanded?: boolean;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
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

// Инициализация: дождаться SDK → ready/expand на весь экран → вытащить имя/фото/язык.
// Тему НЕ трогаем — ей управляет тумблер в шапке.
export function initTelegram(apply: (patch: Partial<StyleProfile>) => void): void {
  if (typeof window === "undefined") return;

  let tries = 0;
  const run = () => {
    const tg = getTelegram();
    if (!tg) {
      if (tries++ < 25) setTimeout(run, 120); // ждём загрузки telegram-web-app.js (~до 3с)
      return;
    }

    try {
      tg.ready();
      tg.expand(); // развернуть на полную высоту (стандартный «весь экран» для Mini App)
      tg.disableVerticalSwipes?.(); // чтобы свайпы внутри не сворачивали окно
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
  };

  run();
}
