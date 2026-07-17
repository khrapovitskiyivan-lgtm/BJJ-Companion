import { describe, it, expect } from "vitest";
import { buildSections, initialPhase, tick, currentDrillIndex, type RunSection } from "./runner";
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

describe("currentDrillIndex", () => {
  it("выбирает технику по прошедшему времени", () => {
    // 2 техники по 1 минуте, раздел 120 сек
    expect(currentDrillIndex([1, 1], 120, 120)).toBe(0); // старт
    expect(currentDrillIndex([1, 1], 120, 61)).toBe(0); // 59-я секунда
    expect(currentDrillIndex([1, 1], 120, 59)).toBe(1); // вторая минута
    expect(currentDrillIndex([1, 1], 120, 1)).toBe(1); // конец
  });
});
