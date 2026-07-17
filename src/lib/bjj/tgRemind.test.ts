import { describe, it, expect } from "vitest";
import { weekMonday, weekReport, decide, type TgChatRow } from "./tgRemind";
import type { DiaryEntry } from "./types";

function entry(date: string): DiaryEntry {
  return { id: date + Math.random(), date, techniqueIds: [1] };
}

// База строки чата: свежая, не замьючена, частота 3, неделя пустая
function row(patch: Partial<TgChatRow> = {}): TgChatRow {
  return {
    tg_user_id: 1,
    frequency: 3,
    week_start: "2026-07-13",
    week_done: 0,
    last_entry: null,
    muted: false,
    last_ping: null,
    updated_at: "2026-07-16T10:00:00+00:00",
    ...patch,
  };
}

// Неделя 13-19 июля 2026 (Пн-Вс)
const MONDAY = "2026-07-13";

describe("weekMonday / weekReport", () => {
  it("понедельник недели и счётчик тренировочных дней", () => {
    // 16 июля 2026 — четверг
    const now = new Date(2026, 6, 16);
    expect(weekMonday(now).getDate()).toBe(13);
    const r = weekReport([entry("2026-07-13"), entry("2026-07-15"), entry("2026-07-06")], now);
    expect(r.weekStart).toBe("2026-07-13");
    expect(r.weekDone).toBe(2); // прошлая неделя не считается
    expect(r.lastEntry).toBe("2026-07-15");
  });

  it("пустой дневник", () => {
    const r = weekReport([], new Date(2026, 6, 16));
    expect(r.weekDone).toBe(0);
    expect(r.lastEntry).toBeNull();
  });
});

describe("decide: напоминания Пн-Пт", () => {
  it("частота 3, неделя пустая: пн-вт рано, со среды горит", () => {
    expect(decide(row(), "2026-07-13", 1, MONDAY).kind).toBe("none"); // пн: осталось 5
    expect(decide(row(), "2026-07-14", 2, MONDAY).kind).toBe("none"); // вт: осталось 4
    const wed = decide(row(), "2026-07-15", 3, MONDAY); // ср: осталось 3 = need 3
    expect(wed.kind).toBe("remind");
    expect(wed.kind === "remind" && wed.text).toContain("0 из 3");
    expect(wed.kind === "remind" && wed.text).toContain("3 дня");
  });

  it("план добит — молчим; сегодня уже отметился — молчим", () => {
    expect(decide(row({ week_done: 3 }), "2026-07-17", 5, MONDAY).kind).toBe("none");
    expect(decide(row({ last_entry: "2026-07-17" }), "2026-07-17", 5, MONDAY).kind).toBe("none");
  });

  it("частичный прогресс сдвигает точку горения", () => {
    // 1 из 3: need 2 — горит с чт (осталось 2)
    expect(decide(row({ week_done: 1 }), "2026-07-15", 3, MONDAY).kind).toBe("none");
    expect(decide(row({ week_done: 1 }), "2026-07-16", 4, MONDAY).kind).toBe("remind");
  });

  it("несвежая неделя (приложение не открывали) считается пустой", () => {
    const d = decide(row({ week_start: "2026-07-06", week_done: 3 }), "2026-07-15", 3, MONDAY);
    expect(d.kind).toBe("remind"); // week_done прошлой недели не в счёт
  });
});

describe("decide: суббота и воскресенье", () => {
  it("суббота — всегда тишина", () => {
    expect(decide(row(), "2026-07-18", 6, MONDAY).kind).toBe("none");
    expect(decide(row({ week_done: 3 }), "2026-07-18", 6, MONDAY).kind).toBe("none");
  });

  it("воскресенье: золотой итог при закрытом плане, мягкий при недоборе", () => {
    const gold = decide(row({ week_done: 3 }), "2026-07-19", 7, MONDAY);
    expect(gold.kind).toBe("recap");
    expect(gold.kind === "recap" && gold.text).toContain("закрыт: 3 из 3");
    const soft = decide(row({ week_done: 2 }), "2026-07-19", 7, MONDAY);
    expect(soft.kind === "recap" && soft.text).toContain("2 из 3");
    expect(soft.kind === "recap" && soft.text).toContain("понедельника");
  });

  it("воскресенье без активности на неделе — молчим", () => {
    expect(decide(row({ week_start: "2026-07-06" }), "2026-07-19", 7, MONDAY).kind).toBe("none");
  });
});

describe("decide: глушители", () => {
  it("muted, нет частоты, уже пинговали сегодня, ушёл 21+ день", () => {
    expect(decide(row({ muted: true, week_done: 0 }), "2026-07-15", 3, MONDAY).kind).toBe("none");
    expect(decide(row({ frequency: null }), "2026-07-15", 3, MONDAY).kind).toBe("none");
    expect(decide(row({ last_ping: "2026-07-15" }), "2026-07-15", 3, MONDAY).kind).toBe("none");
    expect(decide(row({ updated_at: "2026-06-20T10:00:00+00:00" }), "2026-07-15", 3, MONDAY).kind).toBe("none");
  });
});
