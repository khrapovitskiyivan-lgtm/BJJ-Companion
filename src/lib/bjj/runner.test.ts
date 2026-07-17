import { describe, it, expect } from "vitest";
import { buildSections, initialPhase, tick, advanceBy, currentDrillIndex, type RunSection } from "./runner";
import type { Workout } from "./types";

const SECTIONS: RunSection[] = [
  { key: "warmup", title: "Разминка", seconds: 10 },
  { key: "main", title: "Основная часть", seconds: 20 },
  { key: "cooldown", title: "Заминка", seconds: 8 },
];

describe("buildSections", () => {
  it("пропускает пустые разделы", () => {
    const w = {
      warmupMinutes: 5,
      mainMinutes: 20,
      cooldownMinutes: 0,
      drills: [{ technique: { id: 1 }, minutes: 5 }],
      warmup: [],
      cooldown: [],
      totalMinutes: 25,
    } as unknown as Workout;
    const s = buildSections(w);
    expect(s.map((x) => x.key)).toEqual(["warmup", "main"]);
    expect(s[0].seconds).toBe(300);
  });

  it("основа без техник не попадает в разделы", () => {
    const w = {
      warmupMinutes: 5,
      mainMinutes: 20,
      cooldownMinutes: 5,
      drills: [],
      warmup: [],
      cooldown: [],
      totalMinutes: 30,
    } as unknown as Workout;
    expect(buildSections(w).map((x) => x.key)).toEqual(["warmup", "cooldown"]);
  });
});

describe("tick", () => {
  it("обычный тик без сигнала", () => {
    const { next, signal } = tick(SECTIONS, { sectionIdx: 0, left: 9, finished: false });
    expect(next.left).toBe(8);
    expect(signal).toBeNull();
  });

  it("последние 5 секунд раздела дают warn каждую секунду", () => {
    let p = { sectionIdx: 0, left: 6, finished: false };
    const signals: (string | null)[] = [];
    for (let i = 0; i < 5; i++) {
      const r = tick(SECTIONS, p);
      p = r.next;
      signals.push(r.signal);
    }
    expect(signals).toEqual(["warn", "warn", "warn", "warn", "warn"]);
    expect(p.left).toBe(1);
  });

  it("конец раздела: сигнал section и переход к следующему с полным временем", () => {
    const { next, signal } = tick(SECTIONS, { sectionIdx: 0, left: 1, finished: false });
    expect(signal).toBe("section");
    expect(next.sectionIdx).toBe(1);
    expect(next.left).toBe(20);
    expect(next.finished).toBe(false);
  });

  it("конец последнего раздела: сигнал finish и стоп", () => {
    const { next, signal } = tick(SECTIONS, { sectionIdx: 2, left: 1, finished: false });
    expect(signal).toBe("finish");
    expect(next.finished).toBe(true);
    const after = tick(SECTIONS, next);
    expect(after.signal).toBeNull();
    expect(after.next).toEqual(next);
  });

  it("initialPhase: старт с первого раздела; пустой список сразу finished", () => {
    expect(initialPhase(SECTIONS)).toEqual({ sectionIdx: 0, left: 10, finished: false });
    expect(initialPhase([]).finished).toBe(true);
  });
});

describe("advanceBy (догон после сна телефона)", () => {
  it("обычная секунда: один тик", () => {
    const { next, signals } = advanceBy(SECTIONS, { sectionIdx: 0, left: 9, finished: false }, 1);
    expect(next.left).toBe(8);
    expect(signals).toEqual([]);
  });

  it("сон через границу раздела: собирает warn и section, попадает в нужное место", () => {
    // 8 секунд от left=10 первого раздела: 5 warn (5..1) + section, остаток во втором
    const { next, signals } = advanceBy(SECTIONS, { sectionIdx: 0, left: 10, finished: false }, 12);
    expect(signals.filter((s) => s === "warn").length).toBe(5);
    expect(signals).toContain("section");
    expect(next.sectionIdx).toBe(1);
    expect(next.left).toBe(18); // 12 - 10 = 2 секунды во втором разделе (20 - 2)
  });

  it("долгий сон до конца: finish, дальше не идёт", () => {
    const total = 10 + 20 + 8;
    const { next, signals } = advanceBy(SECTIONS, { sectionIdx: 0, left: 10, finished: false }, total + 100);
    expect(next.finished).toBe(true);
    expect(signals).toContain("finish");
    expect(signals.filter((s) => s === "section").length).toBe(2);
  });
});

describe("currentDrillIndex", () => {
  it("выбирает технику по прошедшему времени", () => {
    // 2 техники по 1 минуте, раздел 120 сек
    expect(currentDrillIndex([1, 1], 120, 120)).toBe(0); // старт
    expect(currentDrillIndex([1, 1], 120, 61)).toBe(0); // 59-я секунда
    expect(currentDrillIndex([1, 1], 120, 59)).toBe(1); // вторая минута
    expect(currentDrillIndex([1, 1], 120, 1)).toBe(1); // конец
  });
});
