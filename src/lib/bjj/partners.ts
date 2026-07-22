import { getTelegram, isTelegram } from "@/lib/telegram";

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
}

export type AcceptStatus = "ok" | "self" | "not_found" | "exists" | "limit" | "bad";

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
