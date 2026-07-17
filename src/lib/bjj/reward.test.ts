import { describe, it, expect } from "vitest";
import { computeEntryReward } from "./reward";
import type { DiaryEntry, Technique } from "./types";

function tech(id: number, over: Partial<Technique> = {}): Technique {
  return {
    id, label: `t${id}`, title: `t${id}`, nameRu: `t${id}`, nameEn: `t${id}`,
    group: "position", belt: "white", styles: [], gi: true, noGi: true,
    legal_ibjjf_gi: true, legal_ibjjf_nogi: true, legal_adcc: true,
    points_ibjjf: 0, points_adcc: 0, tags: [], prerequisites: [],
    setup_from: [], common_setups: [], chain_to: [], difficulty: 1,
    successRate: "N/A", energyCost: "Low", content: {}, ...over,
  };
}

function entry(date: string, techniqueIds: number[] = [1], caughtBy?: number[]): DiaryEntry {
  return { id: date + "-" + Math.random(), date, techniqueIds, caughtBy };
}

// 10 pressure + 4 speed + одна без тегов + защита/сабмишен для слота дыры
const PRESSURE = Array.from({ length: 10 }, (_, i) => tech(i + 1, { tags: ["pressure"] }));
const SPEED = Array.from({ length: 4 }, (_, i) => tech(i + 11, { tags: ["speed"] }));
const PLAIN = tech(15);
const CATCHER = tech(100, { group: "submission" });
const ESCAPE_DEF = tech(50, { group: "escape", setup_from: [100] });
const TRANS_DEF = tech(51, { group: "transition", setup_from: [100] });
const TECHS = [...PRESSURE, ...SPEED, PLAIN, CATCHER, ESCAPE_DEF, TRANS_DEF];

const today = new Date(2026, 6, 15); // среда 15 июля 2026, неделя Пн 13 .. Вс 19

function reward(over: Partial<Parameters<typeof computeEntryReward>[0]> = {}) {
  return computeEntryReward({
    entriesBefore: [],
    entry: { date: "2026-07-15", techniqueIds: [1] },
    progressBefore: {},
    techniques: TECHS,
    today,
    ...over,
  });
}

describe("computeEntryReward: слот недели с частотой", () => {
  it("квота добита этой записью: hitNow и серия", () => {
    const r = reward({
      entriesBefore: [entry("2026-07-13"), entry("2026-07-14")],
      frequency: 3,
    });
    expect(r.week).toMatchObject({ kind: "plan", done: 3, quota: 3, hitNow: true, over: false, weekStreak: 1 });
  });

  it("новый день сверх квоты: over", () => {
    const r = reward({
      entriesBefore: [entry("2026-07-13"), entry("2026-07-14"), entry("2026-07-15")],
      entry: { date: "2026-07-16", techniqueIds: [1] },
      frequency: 3,
    });
    expect(r.week).toMatchObject({ kind: "plan", done: 4, hitNow: false, over: true });
  });

  it("вторая запись в тот же день: нейтрально (день уже посчитан)", () => {
    const r = reward({
      entriesBefore: [entry("2026-07-13"), entry("2026-07-14"), entry("2026-07-15")],
      frequency: 3,
    });
    expect(r.week).toMatchObject({ kind: "plan", done: 3, hitNow: false, over: false });
  });

  it("запись задним числом оценивается в своей неделе", () => {
    const r = reward({
      entriesBefore: [entry("2026-07-06")],
      entry: { date: "2026-07-07", techniqueIds: [1] },
      frequency: 2,
    });
    // прошлая неделя добита задним числом; текущая пустая серию не рвёт
    expect(r.week).toMatchObject({ kind: "plan", done: 2, hitNow: true, weekStreak: 1 });
  });
});

describe("computeEntryReward: слот недели без частоты", () => {
  it("дневной стрик считается после записи", () => {
    const r = reward({ entriesBefore: [entry("2026-07-14")] });
    expect(r.week).toEqual({ kind: "days", streak: 2 });
  });
});

describe("computeEntryReward: рост стата", () => {
  it("топ-стат по дробной дельте, count техник записи", () => {
    const r = reward({ entry: { date: "2026-07-15", techniqueIds: [1, 2] } });
    // 2 pressure-техники: (in_progress 1 + отработка 1.5) * 2 = 5 из max 20 = 25%
    expect(r.stat).toBeDefined();
    expect(r.stat!.stat).toBe("pressure");
    expect(r.stat!.pctBefore).toBe(0);
    expect(r.stat!.pctAfter).toBeCloseTo(25, 5);
    expect(r.stat!.count).toBe(2);
  });

  it("уже изученная техника растёт только отработкой", () => {
    const r = reward({ progressBefore: { 1: "done" } });
    // до: 2 из 20 = 10%; после: 3.5 из 20 = 17.5%
    expect(r.stat!.pctBefore).toBeCloseTo(10, 5);
    expect(r.stat!.pctAfter).toBeCloseTo(17.5, 5);
  });

  it("у техник записи нет тегов статов: слот скрыт", () => {
    const r = reward({ entry: { date: "2026-07-15", techniqueIds: [15] } });
    expect(r.stat).toBeUndefined();
  });
});

describe("computeEntryReward: защита", () => {
  const caughtTwice = [entry("2026-07-10", [1], [100]), entry("2026-07-12", [1], [100])];

  it("отработан ответ на топ-catcher: слот с числом поимок", () => {
    const r = reward({
      entriesBefore: caughtTwice,
      entry: { date: "2026-07-15", techniqueIds: [50] },
    });
    expect(r.defense).toBeDefined();
    expect(r.defense!.defense.id).toBe(50);
    expect(r.defense!.catcher.id).toBe(100);
    expect(r.defense!.timesCaught).toBe(2);
  });

  it("побег приоритетнее перехода", () => {
    const r = reward({
      entriesBefore: caughtTwice,
      entry: { date: "2026-07-15", techniqueIds: [51, 50] },
    });
    expect(r.defense!.defense.id).toBe(50);
  });

  it("одна поимка — случайность, слот скрыт", () => {
    const r = reward({
      entriesBefore: [entry("2026-07-10", [1], [100])],
      entry: { date: "2026-07-15", techniqueIds: [50] },
    });
    expect(r.defense).toBeUndefined();
  });

  it("в записи нет защит от catcher: слот скрыт", () => {
    const r = reward({ entriesBefore: caughtTwice });
    expect(r.defense).toBeUndefined();
  });
});
