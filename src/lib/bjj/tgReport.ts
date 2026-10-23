import { getDeviceId, hasConsent } from "./store";
import { getTelegram, getTelegramUser, isTelegram } from "@/lib/telegram";
import { weekReport } from "./tgRemind";
import { pausedUntilForBot } from "./pause";
import { dayKey } from "./plan";
import type { DiaryEntry, Frequency, PausePeriod } from "./types";

// Отчёт для напоминаний бота: только внутри Telegram, fire-and-forget.
// Уходят частота и счётчики недели — без содержимого дневника.
// Повтор при неизменных данных не чаще раза в 12 часов.
// Через доверенный роут /api/tg-report: tg id сервер берёт из подписи initData.

const KEY = "bjj.tgReport.v1";
const TTL = 12 * 60 * 60 * 1000;

export function reportTgPlan(
  frequency: Frequency | undefined,
  entries: DiaryEntry[],
  trainingDays?: number[],
  pauses?: PausePeriod[],
): void {
  if (typeof window === "undefined" || !isTelegram()) return;
  if (!hasConsent()) return; // chat_id и план на сервер только с согласия
  const u = getTelegramUser();
  const initData = getTelegram()?.initData;
  if (!u?.id || !initData) return;
  try {
    const r = weekReport(entries, new Date());
    const payload = {
      device: getDeviceId(),
      frequency: frequency ?? null,
      week_start: r.weekStart,
      week_done: r.weekDone,
      last_entry: r.lastEntry,
      training_days: trainingDays && trainingDays.length ? trainingDays : [0, 1, 2, 3, 4, 5],
      paused_until: pausedUntilForBot(pauses, dayKey(new Date())),
    };
    const hash = JSON.stringify([
      payload.frequency,
      payload.week_start,
      payload.week_done,
      payload.last_entry,
      payload.training_days,
      payload.paused_until,
    ]);
    const prev = JSON.parse(localStorage.getItem(KEY) ?? "null") as { hash: string; at: number } | null;
    if (prev && prev.hash === hash && Date.now() - prev.at < TTL) return;
    void fetch("/api/tg-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, payload }),
    })
      .then((res) => {
        if (res.ok) localStorage.setItem(KEY, JSON.stringify({ hash, at: Date.now() }));
      })
      .catch(() => {});
  } catch {
    // молча: напоминания не должны ломать приложение
  }
}
