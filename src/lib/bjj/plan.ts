import type { DiaryEntry, Frequency } from "./types";

// План тренировок от частоты из профиля: недельные квоты, план и итог месяца.
// Все функции детерминированы — «сегодня» передаётся параметром (тестируемость, SSR-безопасность).

// Ключ дня в локальном времени (yyyy-mm-dd)
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Тренировочные дни: дата -> суммарное число техник (несколько записей в день = один день)
export function trainedByDate(entries: DiaryEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + Math.max(1, e.techniqueIds.length));
  return map;
}

// Сетка месяца: недели Пн-Вс, включая хвосты соседних месяцев. month 0-11.
export function monthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // назад до понедельника
  const grid: Date[][] = [];
  const cursor = new Date(start);
  while (cursor <= last) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(week);
  }
  return grid;
}

export interface WeekStatus {
  done: number; // тренировочных дней в календарной неделе
  quota: number;
  missed: number; // недобор — только для закрытых недель
  over: number; // сверх квоты
  closed: boolean; // неделя целиком в прошлом
  future: boolean; // неделя целиком в будущем
  overDates: Set<string>; // сверхплановые дни (хронологически после квоты)
}

export function weekStatus(week: Date[], trained: Map<string, number>, quota: number, today: Date): WeekStatus {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const trainedDays = week.map(dayKey).filter((k) => trained.has(k)); // хронологический порядок недели
  const done = trainedDays.length;
  const closed = week[6] < t0;
  const future = week[0] > t0;
  const over = Math.max(0, done - quota);
  return {
    done,
    quota,
    missed: closed ? Math.max(0, quota - done) : 0,
    over,
    closed,
    future,
    overDates: new Set(trainedDays.slice(quota)),
  };
}

// Стрик недель в плане: сколько календарных недель подряд выполнена квота.
// Текущая неделя засчитывается, как только квота добита; пока нет — стрик
// прошлых недель не сгорает (нельзя терять серию в середине недели).
export function planStreak(trained: Map<string, number>, quota: Frequency, today: Date): number {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monday = new Date(t0);
  monday.setDate(t0.getDate() - ((t0.getDay() + 6) % 7));

  const weekDone = (start: Date): number => {
    let n = 0;
    const c = new Date(start);
    for (let i = 0; i < 7; i++) {
      if (trained.has(dayKey(c))) n++;
      c.setDate(c.getDate() + 1);
    }
    return n;
  };

  let streak = 0;
  const cursor = new Date(monday);
  if (weekDone(cursor) >= quota) streak++;
  // Назад по закрытым неделям; предохранитель — 10 лет
  for (let i = 0; i < 520; i++) {
    cursor.setDate(cursor.getDate() - 7);
    if (weekDone(cursor) >= quota) streak++;
    else break;
  }
  return streak;
}

// План месяца: квота в неделю, приведённая к длине месяца
export function monthPlan(quota: Frequency, year: number, month: number): number {
  const days = new Date(year, month + 1, 0).getDate();
  return Math.round((quota * days) / 7);
}

export type MonthVerdict = "under" | "met" | "over" | "on_track" | "behind";

export interface MonthSummary {
  plan: number;
  done: number;
  current: boolean; // это текущий месяц (итог промежуточный)
  verdict: MonthVerdict;
}

export function monthSummary(
  trained: Map<string, number>,
  quota: Frequency,
  year: number,
  month: number,
  today: Date,
): MonthSummary {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const done = [...trained.keys()].filter((k) => k.startsWith(prefix)).length;
  const plan = monthPlan(quota, year, month);
  const current = today.getFullYear() === year && today.getMonth() === month;
  let verdict: MonthVerdict;
  if (current) {
    const planToDate = Math.round((quota * today.getDate()) / 7);
    verdict = done >= planToDate ? "on_track" : "behind";
  } else {
    verdict = done < plan ? "under" : done > plan ? "over" : "met";
  }
  return { plan, done, current, verdict };
}
