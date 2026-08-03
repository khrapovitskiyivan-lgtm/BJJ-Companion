import type { DiaryEntry, Frequency, PausePeriod } from "./types";
import { dayKey, trainedByDate, weekDays, weekStatus, planStreak, dayStreak, daysLeftInWeek } from "./plan";
import { activePause } from "./pause";

// Модель блока «Сегодня» на «Моей игре»: статус недели по плану из частоты.
// Чистая функция — «сегодня» параметром (тестируемость, SSR-безопасность).

export interface TodayCardModel {
  loggedToday: boolean;
  // Строка недели — только при заданной частоте
  week?: { done: number; quota: number; over: number; daysLeft: number };
  // Активная пауза: показываем спокойное «На паузе» вместо недельного плана
  paused?: { until?: string };
  weeksStreak: number; // недель в плане подряд (UI показывает при >= 2)
  daysStreakNoPlan: number; // дневной стрик — только без частоты
}

export function todayCardModel(
  entries: DiaryEntry[],
  frequency: Frequency | undefined,
  today: Date,
  trainingDays?: number[],
  pauses?: PausePeriod[],
): TodayCardModel {
  const trained = trainedByDate(entries);
  const loggedToday = trained.has(dayKey(today));
  const pause = activePause(pauses, dayKey(today));
  if (pause) {
    // На паузе: план не показываем, серия заморожена (planStreak/dayStreak с pauses)
    return {
      loggedToday,
      paused: { until: pause.until },
      weeksStreak: frequency ? planStreak(trained, frequency, today, pauses) : 0,
      daysStreakNoPlan: frequency ? 0 : dayStreak(trained, today, pauses),
    };
  }
  if (!frequency) {
    return { loggedToday, weeksStreak: 0, daysStreakNoPlan: dayStreak(trained, today, pauses) };
  }
  const ws = weekStatus(weekDays(today), trained, frequency, today);
  return {
    loggedToday,
    week: { done: ws.done, quota: ws.quota, over: ws.over, daysLeft: daysLeftInWeek(today, loggedToday, trainingDays) },
    weeksStreak: planStreak(trained, frequency, today, pauses),
    daysStreakNoPlan: 0,
  };
}
