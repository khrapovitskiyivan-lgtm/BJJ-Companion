// === Telegram Mini App интеграция ===
// Повторяет рабочий подход из bjj-map: ready → expand → requestFullscreen (через 100мс),
// пользователь достаётся тремя способами (initDataUnsafe → парсинг initData → кэш).
// SDK-скрипт грузится асинхронно — поэтому ждём появления window.Telegram.WebApp.
import type { StyleProfile } from "./bjj/types";

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

interface HapticFeedbackApi {
  impactOccurred?(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred?(type: "error" | "success" | "warning"): void;
  selectionChanged?(): void;
}

interface TgWebApp {
  ready(): void;
  expand(): void;
  initData: string;
  initDataUnsafe?: { user?: TgUser };
  colorScheme?: "light" | "dark";
  isExpanded?: boolean;
  HapticFeedback?: HapticFeedbackApi;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  setHeaderColor?(color: string): void;
  onEvent?(event: string, cb: () => void): void;
}

const USER_CACHE_KEY = "bjj_telegram_user";

export function getTelegram(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  const tg = getTelegram();
  return !!tg && typeof tg.initData === "string" && tg.initData.length > 0;
}

// === Тактильная отдача === (Telegram HapticFeedback, фоллбэк — navigator.vibrate)
type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

export function haptic(style: HapticStyle = "light"): void {
  const hf = getTelegram()?.HapticFeedback;
  if (hf?.impactOccurred) {
    try {
      hf.impactOccurred(style);
      return;
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(style === "heavy" ? 30 : style === "medium" ? 18 : 10);
  }
}

export function hapticSuccess(): void {
  const hf = getTelegram()?.HapticFeedback;
  if (hf?.notificationOccurred) {
    try {
      hf.notificationOccurred("success");
      return;
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([10, 40, 15]);
}

// Надёжное получение пользователя: три способа + кэш (как в bjj-map).
export function getTelegramUser(): TgUser | null {
  const tg = getTelegram();
  let user: TgUser | null = tg?.initDataUnsafe?.user ?? null;

  // Способ 2: парсинг строки initData
  if (!user && tg?.initData) {
    try {
      const params = new URLSearchParams(tg.initData);
      const s = params.get("user");
      if (s) user = JSON.parse(s) as TgUser;
    } catch {
      /* ignore */
    }
  }
  // Способ 3: кэш из localStorage
  if (!user && typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      if (cached) user = JSON.parse(cached) as TgUser;
    } catch {
      /* ignore */
    }
  }
  // сохраняем свежего пользователя в кэш
  if (user && typeof window !== "undefined") {
    try {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }
  return user;
}

// Инициализация: дождаться SDK → ready/expand/fullscreen → вытащить имя/фото/язык.
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
      tg.expand();
      tg.disableVerticalSwipes?.();
      // requestFullscreen — именно он даёт «весь экран» (Bot API 8.0+); с задержкой, как в bjj-map
      setTimeout(() => {
        try {
          tg.requestFullscreen?.();
        } catch {
          /* ignore */
        }
      }, 100);
    } catch {
      /* ignore */
    }

    const u = getTelegramUser();
    if (!u) return;

    const patch: Partial<StyleProfile> = {};
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username || "";
    if (name) patch.name = name;
    if (u.photo_url) patch.avatarUrl = u.photo_url;
    if (u.language_code === "en") patch.locale = "en";

    if (Object.keys(patch).length) apply(patch);
  };

  run();
}
