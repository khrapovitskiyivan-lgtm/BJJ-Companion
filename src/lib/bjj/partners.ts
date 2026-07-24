import { getTelegram, isTelegram } from "@/lib/telegram";
import { shareText, buildInviteLink } from "./share";

// Клиент партнёров: всё через доверенный роут /api/partners (он проверяет подпись
// Telegram и ходит в базу сервисным ключом). Работает только внутри Telegram.

export interface PartnerProfile {
  tg_user_id: number;
  name: string | null;
  photo_url: string | null;
  belt: string | null;
  gi: boolean;
  nogi: boolean;
  style: string | null;
  stats: Record<string, number>;
  week_start: string | null;
  week_done: number;
  quota: number | null;
  week_streak: number;
  level?: number; // уровень игрока (может отсутствовать до применения SQL-миграции)
}

export interface PublishInput {
  device: string;
  belt: string;
  gi: boolean;
  nogi: boolean;
  style: string | null;
  stats: Record<string, number>;
  weekStart: string | null;
  weekDone: number;
  quota: number | null;
  streak: number;
  level: number;
}

export type AcceptStatus = "ok" | "self" | "not_found" | "exists" | "limit" | "bad";

// Локальный флаг «участвую в партнёрах»: ставится при приглашении/приёме/наличии
// партнёров. По нему AppShell решает, держать ли свой профиль свежим (не публикуем
// имя/фото тех, кто фичу не трогал).
const JOINED_KEY = "bjj.partnersJoined.v1";

export function markPartnersJoined(): void {
  try {
    localStorage.setItem(JOINED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isPartnersJoined(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(JOINED_KEY) === "1";
  } catch {
    return false;
  }
}

// Отложенный код приглашения: ловим start_param сразу при запуске (в AppShell, до
// онбординга) и храним, чтобы промпт «Принять?» показался после онбординга у нового
// пользователя — start_param к тому моменту может быть уже недоступен.
const PENDING_KEY = "bjj.pendingInvite.v1";

export function setPendingInvite(code: string): void {
  try {
    if (!localStorage.getItem(PENDING_KEY)) localStorage.setItem(PENDING_KEY, code);
  } catch {
    /* ignore */
  }
}

export function getPendingInvite(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

async function post<T>(action: string, payload: Record<string, unknown>): Promise<T | null> {
  const tg = getTelegram();
  if (!isTelegram() || !tg?.initData) return null;
  try {
    const r = await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg.initData, action, payload }),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// Опубликовать/обновить свой профиль, вернуть код-приглашение
export async function publishProfile(input: PublishInput): Promise<string | null> {
  const res = await post<{ code: string | null }>("publish", { ...input });
  return res?.code ?? null;
}

// Принять приглашение по коду
export async function acceptPartner(ref: string): Promise<AcceptStatus | null> {
  const res = await post<{ status: AcceptStatus }>("accept", { ref });
  return res?.status ?? null;
}

// Список партнёров со статусом недели
export async function listPartners(): Promise<PartnerProfile[]> {
  const res = await post<{ partners: PartnerProfile[] }>("list", {});
  return res?.partners ?? [];
}

// Удалить партнёра
export async function removePartner(other: number): Promise<boolean> {
  const res = await post<{ ok: boolean }>("remove", { other });
  return !!res?.ok;
}

// Общий invite-флоу: публикует профиль, помечает участие, открывает шторку выбора
// чата с личной ссылкой-кодом. Используют кнопка «Пригласить» и холодный старт.
export async function sharePartnerInvite(input: PublishInput): Promise<string | null> {
  const code = await publishProfile(input);
  if (!code) return null;
  markPartnersJoined();
  await shareText(
    "Давай держать недельный план вместе в BJJ Companion. Прими приглашение в партнёры:",
    buildInviteLink(code),
  );
  return code;
}
