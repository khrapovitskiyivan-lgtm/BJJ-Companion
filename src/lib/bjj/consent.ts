import type { StyleProfile } from "./types";

// Согласие на обработку/отправку данных. Вынесено из store.ts, чтобы отправщики
// и тесты могли проверять согласие без импорта supabase-клиента.

const PROFILE_KEY = "bjj.profile.v1";

// Версия согласия. Bump заставит гейт показаться повторно всем пользователям
// (например, при существенном изменении Политики). Гейт виден, пока
// profile.consentVersion < CONSENT_VERSION.
export const CONSENT_VERSION = 1;

// Разрешена ли отправка данных на сервер. Читается синхронно самими
// отправщиками (telemetry/globalStats/tgReport/sync): update() пишет профиль в
// localStorage синхронно до публикации снимка, поэтому чтения localStorage
// достаточно. true только при явном согласии 'accepted' текущей версии; локальный
// режим и непройденный гейт дают false.
export function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<StyleProfile>) : {};
    return p.consentChoice === "accepted" && (p.consentVersion ?? 0) >= CONSENT_VERSION;
  } catch {
    return false;
  }
}
