import { describe, it, expect } from "vitest";
import { todayCardModel } from "./todayCard";
import type { DiaryEntry } from "./types";

function entry(date: string): DiaryEntry {
  return { id: date, date, techniqueIds: [1] };
}
// 16 июля 2026 — четверг; неделя 13-19 июля
const today = new Date(2026, 6, 16);

describe("todayCardModel", () => {
  it("без частоты: дневной стрик, week отсутствует", () => {
    const m = todayCardModel([entry("2026-07-15"), entry("2026-07-16")], undefined, today);
    expect(m.loggedToday).toBe(true);
    expect(m.week).toBeUndefined();
    expect(m.daysStreakNoPlan).toBe(2);
  });

  it("частота 3, сегодня не записано: done/quota/daysLeft", () => {
    const m = todayCardModel([entry("2026-07-13"), entry("2026-07-14")], 3, today);
    expect(m.loggedToday).toBe(false);
    expect(m.week).toEqual({ done: 2, quota: 3, over: 0, daysLeft: 3 }); // чт+пт+сб
    expect(m.daysStreakNoPlan).toBe(0);
  });

  it("квота перевыполнена: over и серия недель", () => {
    const m = todayCardModel(
      ["2026-07-06", "2026-07-07", "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"].map(entry),
      2,
      today,
    );
    expect(m.week).toEqual({ done: 4, quota: 2, over: 2, daysLeft: 2 }); // пт+сб
    expect(m.weeksStreak).toBe(2); // прошлая неделя 2/2 + текущая добита
  });
});
