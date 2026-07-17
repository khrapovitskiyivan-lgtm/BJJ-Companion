import { describe, it, expect } from "vitest";
import { dayKey, dayStreak, monthGrid, monthPlan, weekDays, weekStatus, monthSummary, trainedByDate, planStreak } from "./plan";
import type { DiaryEntry } from "./types";

function entry(date: string, techs = 1): DiaryEntry {
  return { id: date + "-" + Math.random(), date, techniqueIds: Array.from({ length: techs }, (_, i) => i + 1) };
}

// Локальная дата без времени
function d(y: number, m: number, day: number): Date {
  return new Date(y, m, day);
}

describe("trainedByDate", () => {
  it("несколько записей в один день складываются в один тренировочный день", () => {
    const map = trainedByDate([entry("2026-07-06", 2), entry("2026-07-06", 3)]);
    expect(map.size).toBe(1);
    expect(map.get("2026-07-06")).toBe(5);
  });
});

describe("monthGrid", () => {
  it("июль 2026: 5 недель Пн-Вс, первая начинается 29 июня", () => {
    const grid = monthGrid(2026, 6);
    expect(grid.length).toBe(5);
    for (const week of grid) expect(week.length).toBe(7);
    expect(dayKey(grid[0][0])).toBe("2026-06-29");
    expect(grid[0][0].getDay()).toBe(1); // понедельник
    expect(dayKey(grid[4][6])).toBe("2026-08-02");
  });
});

describe("monthPlan", () => {
  it("31 день при 3/нед = 13, 28 дней при 1/нед = 4, 31 день при 4/нед = 18", () => {
    expect(monthPlan(3, 2026, 6)).toBe(13); // июль
    expect(monthPlan(1, 2027, 1)).toBe(4); // февраль 2027, 28 дней
    expect(monthPlan(4, 2026, 6)).toBe(18);
  });
});

describe("weekStatus", () => {
  const today = d(2026, 6, 16); // 16 июля 2026, четверг
  const week = monthGrid(2026, 6)[1]; // 6-12 июля, закрытая

  it("закрытая неделя 2/3: недобор 1", () => {
    const trained = trainedByDate([entry("2026-07-06"), entry("2026-07-08")]);
    const st = weekStatus(week, trained, 3, today);
    expect(st.closed).toBe(true);
    expect(st.done).toBe(2);
    expect(st.missed).toBe(1);
    expect(st.over).toBe(0);
  });

  it("4 дня при квоте 3: один сверхплановый, хронологически последний", () => {
    const trained = trainedByDate([entry("2026-07-06"), entry("2026-07-07"), entry("2026-07-09"), entry("2026-07-11")]);
    const st = weekStatus(week, trained, 3, today);
    expect(st.over).toBe(1);
    expect(st.overDates.has("2026-07-11")).toBe(true);
    expect(st.overDates.has("2026-07-06")).toBe(false);
  });

  it("текущая неделя не осуждается: недобора нет", () => {
    const current = monthGrid(2026, 6)[2]; // 13-19 июля
    const st = weekStatus(current, trainedByDate([]), 3, today);
    expect(st.closed).toBe(false);
    expect(st.missed).toBe(0);
  });

  it("будущая неделя помечена как будущая", () => {
    const future = monthGrid(2026, 6)[4]; // 27 июля - 2 августа
    const st = weekStatus(future, trainedByDate([]), 3, today);
    expect(st.future).toBe(true);
  });

  it("неделя на стыке месяцев учитывает дни обоих месяцев", () => {
    const cross = monthGrid(2026, 6)[0]; // 29 июня - 5 июля
    const trained = trainedByDate([entry("2026-06-29"), entry("2026-06-30"), entry("2026-07-01")]);
    const st = weekStatus(cross, trained, 3, today);
    expect(st.done).toBe(3);
    expect(st.missed).toBe(0);
  });
});

describe("monthSummary", () => {
  const today = d(2026, 6, 16);

  it("закрытый месяц: меньше плана / равно / больше", () => {
    const june = (n: number) =>
      trainedByDate(Array.from({ length: n }, (_, i) => entry(`2026-06-${String(i + 1).padStart(2, "0")}`)));
    // июнь 2026: 30 дней, план при 3/нед = round(90/7) = 13
    expect(monthSummary(june(12), 3, 2026, 5, today).verdict).toBe("under");
    expect(monthSummary(june(13), 3, 2026, 5, today).verdict).toBe("met");
    expect(monthSummary(june(14), 3, 2026, 5, today).verdict).toBe("over");
  });

  it("текущий месяц: по плану или отстаёт от плана-на-сегодня", () => {
    const july = (n: number) =>
      trainedByDate(Array.from({ length: n }, (_, i) => entry(`2026-07-${String(i + 1).padStart(2, "0")}`)));
    // план-на-16-июля при 3/нед = round(48/7) = 7
    const onTrack = monthSummary(july(7), 3, 2026, 6, today);
    expect(onTrack.current).toBe(true);
    expect(onTrack.verdict).toBe("on_track");
    expect(monthSummary(july(6), 3, 2026, 6, today).verdict).toBe("behind");
    expect(onTrack.plan).toBe(13);
    expect(onTrack.done).toBe(7);
  });
});

describe("planStreak", () => {
  // 16 июля 2026 — четверг; текущая неделя Пн 13 — Вс 19
  const today = d(2026, 6, 16);
  const weeks = (dates: string[]) => trainedByDate(dates.map((x) => entry(x)));

  it("пустой дневник — стрик 0", () => {
    expect(planStreak(weeks([]), 3, today)).toBe(0);
  });

  it("прошлые недели с квотой считаются, недобитая текущая стрик не сжигает", () => {
    // три прошлые недели по 3 тренировки (Пн/Ср/Пт), текущая пустая
    const t = weeks([
      "2026-06-22", "2026-06-24", "2026-06-26",
      "2026-06-29", "2026-07-01", "2026-07-03",
      "2026-07-06", "2026-07-08", "2026-07-10",
    ]);
    expect(planStreak(t, 3, today)).toBe(3);
  });

  it("текущая неделя добавляется, как только квота добита", () => {
    const t = weeks([
      "2026-07-06", "2026-07-08", "2026-07-10",
      "2026-07-13", "2026-07-14", "2026-07-15",
    ]);
    expect(planStreak(t, 3, today)).toBe(2);
  });

  it("разрыв обнуляет более старые недели", () => {
    const t = weeks([
      "2026-06-22", "2026-06-24", "2026-06-26",
      // неделя 29.06-05.07 пропущена
      "2026-07-06", "2026-07-08", "2026-07-10",
    ]);
    expect(planStreak(t, 3, today)).toBe(1);
  });

  it("недобор квоты в неделе не считается", () => {
    const t = weeks(["2026-07-06", "2026-07-08"]);
    expect(planStreak(t, 3, today)).toBe(0);
  });
});

describe("weekDays", () => {
  it("среда 15 июля 2026 -> неделя Пн 13 .. Вс 19", () => {
    const wk = weekDays(d(2026, 6, 15));
    expect(wk.length).toBe(7);
    expect(dayKey(wk[0])).toBe("2026-07-13");
    expect(wk[0].getDay()).toBe(1); // понедельник
    expect(dayKey(wk[6])).toBe("2026-07-19");
  });
});

describe("dayStreak", () => {
  it("пустой дневник — ноль", () => {
    expect(dayStreak(trainedByDate([]), d(2026, 6, 16))).toBe(0);
  });

  it("сегодня и вчера — 2", () => {
    const t = trainedByDate([entry("2026-07-15"), entry("2026-07-16")]);
    expect(dayStreak(t, d(2026, 6, 16))).toBe(2);
  });

  it("сегодня ещё не тренировался — серия от вчера не сгорает", () => {
    const t = trainedByDate([entry("2026-07-15")]);
    expect(dayStreak(t, d(2026, 6, 16))).toBe(1);
  });

  it("разрыв обрывает серию", () => {
    const t = trainedByDate([entry("2026-07-13"), entry("2026-07-15"), entry("2026-07-16")]);
    expect(dayStreak(t, d(2026, 6, 16))).toBe(2);
  });
});
