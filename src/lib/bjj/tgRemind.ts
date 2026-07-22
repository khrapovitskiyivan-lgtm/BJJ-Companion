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
  training_days: number[] | null; // 0=Пн..6=Вс; null/пусто = дефолт Пн-Сб
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
// Тренировочные дни — из row.training_days (0=Пн..6=Вс); пусто/null = дефолт Пн-Сб.
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

  const days = row.training_days && row.training_days.length ? row.training_days : [0, 1, 2, 3, 4, 5];
  const set = new Set(days);
  const d0 = dow - 1; // 0=Пн..6=Вс

  // Воскресенье: итог недели (конец календарной недели)
  if (d0 === 6) {
    if (!fresh) return { kind: "none" }; // неактивная неделя — нечего подводить
    const text =
      done >= quota
        ? `План недели закрыт: ${done} из ${quota}. Так держать.`
        : `На этой неделе ${done} из ${quota}. Новая неделя с понедельника.`;
    return { kind: "recap", text };
  }

  // Не тренировочный день — молчим
  if (!set.has(d0)) return { kind: "none" };

  // Оставшиеся тренировочные дни строго после сегодня (до вс включительно)
  let after = 0;
  for (let d = d0 + 1; d <= 6; d++) if (set.has(d)) after++;
  // Сегодня последний тренировочный день недели — к вечеру окно прошло, молчим
  if (after === 0) return { kind: "none" };

  // Горит, когда будущих тренировочных дней уже не хватает на недостающие тренировки
  const need = quota - done;
  if (need <= 0) return { kind: "none" };
  if (row.last_entry === todayIso) return { kind: "none" }; // сегодня уже отметился
  if (need < after) return { kind: "none" };
  const text = `План недели под угрозой: ${done} из ${quota}, осталось ${after} ${dayWord(after)} до конца недели. Тренировался — отметь в два тапа. Отключить напоминания: /mute`;
  return { kind: "remind", text };
}
