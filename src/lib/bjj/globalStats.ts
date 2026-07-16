import { supabase } from "@/lib/supabase";
import { getDeviceId } from "./store";
import type { Belt } from "./types";

// Глобальная статистика игроков: анонимный учёт по device_id через RPC-функции
// (см. docs/sql/2026-07-17-global-stats.sql). Данные самодекларируемые; прямого
// доступа к таблице у anon-ключа нет, только security definer функции.

const REPORT_KEY = "bjj.playerReport.v1";
const REPORT_TTL = 24 * 60 * 60 * 1000; // повторный отчёт не чаще раза в сутки (или при смене пояса)

export interface GlobalStats {
  players: number;
  belts: Partial<Record<Belt, number>>;
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(p).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Сообщить пояс устройства (fire-and-forget: статистика не должна ломать приложение)
export function reportPlayer(belt: Belt): void {
  if (typeof window === "undefined") return;
  try {
    const prev = JSON.parse(localStorage.getItem(REPORT_KEY) ?? "null") as { belt: Belt; at: number } | null;
    if (prev && prev.belt === belt && Date.now() - prev.at < REPORT_TTL) return;
    void withTimeout(supabase.rpc("bjj_report_player", { p_device: getDeviceId(), p_belt: belt }), 5000).then(
      (res) => {
        if (res && !res.error) localStorage.setItem(REPORT_KEY, JSON.stringify({ belt, at: Date.now() }));
      },
    );
  } catch {
    // молча: нет сети или битый localStorage — не мешаем пользователю
  }
}

export async function fetchGlobalStats(): Promise<GlobalStats | null> {
  const res = await withTimeout(supabase.rpc("bjj_global_stats"), 5000);
  if (!res || res.error || res.data == null) return null;
  const data = res.data as { players?: number; belts?: Partial<Record<Belt, number>> };
  return { players: data.players ?? 0, belts: data.belts ?? {} };
}
