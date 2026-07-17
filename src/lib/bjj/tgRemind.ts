import type { DiaryEntry } from "./types";
import { dayKey, trainedByDate } from "./plan";

// Напоминания бота: чистая логика, общая для клиента (отчёт недели) и крона
// (решение «слать или молчать»). Модель недели: тренировочные дни Пн-Сб,
// воскресенье всегда выходной (последняя тренировка недели — суббота утро).
// Пн-Пт вечером напоминаем, только когда «план горит»; сб — тишина;
// вс — итог недели. Все даты параметрами: тестируемость и SSR-безопасность.

// Понедельник недели данной даты (локальное время)
export function weekMonday(d: Date): Date {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t;
}

// Отчёт недели для bjj_tg_report: тренировочные дни текущей недели и последняя запись
export function weekReport(
  entries: DiaryEntry[],
  now: Date,
): { weekStart: string; weekDone: number; lastEntry: string | null } {
  const monday = weekMonday(now);
  const trained = trainedByDate(entries);
  let done = 0;
  const c = new Date(monday);
  for (let i = 0; i < 7; i++) {
    if (trained.has(dayKey(c))) done++;
    c.setDate(c.getDate() + 1);
  }
  let last: string | null = null;
  for (const e of entries) if (!last || e.date > last) last = e.date;
  return { weekStart: dayKey(monday), weekDone: done, lastEntry: last };
}

// Строка bjj_tg_chats (снейк-кейс как в Postgres)
export interface TgChatRow {
  tg_user_id: number;
  frequency: number | null;
  week_start: string | null;
  week_done: number;
  last_entry: string | null;
  muted: boolean;
  last_ping: string | null;
  updated_at: string;
}

export type CronDecision = { kind: "none" } | { kind: "remind" | "recap"; text: string };

function dayWord(n: number): string {
  if (n === 1) return "день";
  if (n >= 2 && n <= 4) return "дня";
  return "дней";
}

// Решение по одному чату. dow: 1=Пн..7=Вс (по МСК), mondayIso — понедельник текущей недели.
export function decide(row: TgChatRow, todayIso: string, dow: number, mondayIso: string): CronDecision {
  if (row.muted || !row.frequency) return { kind: "none" };
  if (row.last_ping === todayIso) return { kind: "none" }; // не чаще раза в день

  // 21 день не открывал приложение — ушёл, не спамим
  const staleMs = Date.parse(todayIso) - Date.parse(row.updated_at);
  if (Number.isNaN(staleMs) || staleMs > 21 * 86_400_000) return { kind: "none" };

  // Счётчик недели актуален, только если приложение открывали на этой неделе
  const fresh = row.week_start === mondayIso;
  const done = fresh ? row.week_done : 0;
  const quota = row.frequency;

  // Воскресенье: итог недели (неделя закрыта в субботу утром)
  if (dow === 7) {
    if (!fresh) return { kind: "none" }; // неактивная неделя — нечего подводить
    const text =
      done >= quota
        ? `План недели закрыт: ${done} из ${quota}. Так держать.`
        : `На этой неделе ${done} из ${quota}. Новая неделя с понедельника.`;
    return { kind: "recap", text };
  }

  // Суббота: тренировка была утром, вечером молчим
  if (dow === 6) return { kind: "none" };

  // Пн-Пт: горит, когда оставшихся тренировочных дней (после сегодня, до сб)
  // впритык или меньше, чем недостающих тренировок
  const daysLeft = 6 - dow;
  const need = quota - done;
  if (need <= 0) return { kind: "none" };
  if (row.last_entry === todayIso) return { kind: "none" }; // сегодня уже отметился
  if (need < daysLeft) return { kind: "none" };
  const text = `План недели под угрозой: ${done} из ${quota}, осталось ${daysLeft} ${dayWord(daysLeft)} до конца недели (сб). Тренировался — отметь в два тапа. Отключить напоминания: /mute`;
  return { kind: "remind", text };
}
