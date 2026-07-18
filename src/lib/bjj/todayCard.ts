import type { DiaryEntry, Frequency } from "./types";
import { dayKey, trainedByDate, weekDays, weekStatus, planStreak, dayStreak, daysLeftInWeek } from "./plan";

// Модель блока «Сегодня» на «Моей игре»: статус недели по плану из частоты.
// Чистая функция — «сегодня» параметром (тестируемость, SSR-безопасность).

export interface TodayCardModel {
  loggedToday: boolean;
  // Строка недели — только при заданной частоте
  week?: { done: number; quota: number; over: number; daysLeft: number };
  weeksStreak: number; // недель в плане подряд (UI показывает при >= 2)
  daysStreakNoPlan: number; // дневной стрик — только без частоты
}

export function todayCardModel(
  entries: DiaryEntry[],
  frequency: Frequency | undefined,
  today: Date,
): TodayCardModel {
  const trained = trainedByDate(entries);
  const loggedToday = trained.has(dayKey(today));
  if (!frequency) {
    return { loggedToday, weeksStreak: 0, daysStreakNoPlan: dayStreak(trained, today) };
  }
  const ws = weekStatus(weekDays(today), trained, frequency, today);
  return {
    loggedToday,
    week: { done: ws.done, quota: ws.quota, over: ws.over, daysLeft: daysLeftInWeek(today, loggedToday) },
    weeksStreak: planStreak(trained, frequency, today),
    daysStreakNoPlan: 0,
  };
}
