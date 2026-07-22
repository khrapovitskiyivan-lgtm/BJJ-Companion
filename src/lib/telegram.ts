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
  initDataUnsafe?: { user?: TgUser; start_param?: string };
  colorScheme?: "light" | "dark";
  isExpanded?: boolean;
  HapticFeedback?: HapticFeedbackApi;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  setHeaderColor?(color: string): void;
  onEvent?(event: string, cb: () => void): void;
  openTelegramLink?(url: string): void;
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

// start_param из deep-link (t.me/bot?startapp=CODE): сначала из initDataUnsafe,
// иначе парсим строку initData. Используется приёмом приглашения партнёра.
export function getStartParam(): string | null {
  const tg = getTelegram();
  const direct = tg?.initDataUnsafe?.start_param;
  if (direct) return direct;
  if (tg?.initData) {
    try {
      return new URLSearchParams(tg.initData).get("start_param");
    } catch {
      /* ignore */
    }
  }
  return null;
}

// === Тема сессии ===
// Модульные флаги живут ровно один запуск webview: новая сессия — снова авто.
let themeSynced = false; // авто-тема из colorScheme уже применена в этом запуске
let themeManual = false; // пользователь выбрал тему руками — авто молчит до конца сессии

// Зовётся тумблером темы в шапке: ручной выбор главнее авто до следующего запуска
export function markThemeManual(): void {
  themeManual = true;
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

    // Тема следует за Telegram (день/ночь) один раз на запуск сессии + по событию
    // themeChanged. Только внутри Telegram: в обычном браузере SDK тоже грузится,
    // но colorScheme там всегда light — затирал бы тёмную тему web-PWA.
    // themeSynced: AppShell перемонтируется на каждой навигации и зовёт initTelegram
    // заново — без флага авто-тема затирала бы ручной выбор при каждом переходе.
    // Ручной выбор (markThemeManual) держится до конца сессии.
    if (isTelegram() && !themeSynced) {
      themeSynced = true;
      if (tg.colorScheme && !themeManual) apply({ theme: tg.colorScheme });
      tg.onEvent?.("themeChanged", () => {
        if (themeManual) return;
        const cs = getTelegram()?.colorScheme;
        if (cs) apply({ theme: cs });
      });
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
