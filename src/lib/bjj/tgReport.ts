import { supabase } from "@/lib/supabase";
import { getDeviceId } from "./store";
import { getTelegramUser, isTelegram } from "@/lib/telegram";
import { weekReport } from "./tgRemind";
import type { DiaryEntry, Frequency } from "./types";

// Отчёт для напоминаний бота: только внутри Telegram, fire-and-forget.
// Уходят частота и счётчики недели — без содержимого дневника.
// Повтор при неизменных данных не чаще раза в 12 часов.

const KEY = "bjj.tgReport.v1";
const TTL = 12 * 60 * 60 * 1000;

export function reportTgPlan(
  frequency: Frequency | undefined,
  entries: DiaryEntry[],
  trainingDays?: number[],
): void {
  if (typeof window === "undefined" || !isTelegram()) return;
  const u = getTelegramUser();
  if (!u?.id) return;
  try {
    const r = weekReport(entries, new Date());
    const payload = {
      p_tg: u.id,
      p_device: getDeviceId(),
      p_frequency: frequency ?? null,
      p_week_start: r.weekStart,
      p_week_done: r.weekDone,
      p_last_entry: r.lastEntry,
      p_training_days: trainingDays && trainingDays.length ? trainingDays : [0, 1, 2, 3, 4, 5],
    };
    const hash = JSON.stringify([
      payload.p_frequency,
      payload.p_week_start,
      payload.p_week_done,
      payload.p_last_entry,
      payload.p_training_days,
    ]);
    const prev = JSON.parse(localStorage.getItem(KEY) ?? "null") as { hash: string; at: number } | null;
    if (prev && prev.hash === hash && Date.now() - prev.at < TTL) return;
    void Promise.resolve(supabase.rpc("bjj_tg_report", payload))
      .then((res) => {
        if (res && !res.error) localStorage.setItem(KEY, JSON.stringify({ hash, at: Date.now() }));
      })
      .catch(() => {});
  } catch {
    // молча: напоминания не должны ломать приложение
  }
}
