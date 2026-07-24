import { describe, it, expect } from "vitest";
import { levelForXp, skillLevel } from "./xp";

describe("levelForXp: пороги min(50*L, 400)", () => {
  it("0 XP — уровень 1, до следующего 50", () => {
    expect(levelForXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForLevel: 50, xpToNext: 50 });
  });
  it("50 XP — ровно уровень 2", () => {
    expect(levelForXp(50)).toEqual({ level: 2, xpIntoLevel: 0, xpForLevel: 100, xpToNext: 100 });
  });
  it("60 XP — уровень 2, 10 внутри", () => {
    expect(levelForXp(60)).toMatchObject({ level: 2, xpIntoLevel: 10, xpForLevel: 100, xpToNext: 90 });
  });
  it("150 XP — уровень 3 (50+100)", () => {
    expect(levelForXp(150)).toMatchObject({ level: 3 });
  });
  it("плато 400: уровень 10 при 2200 (…+400)", () => {
    // 50+100+150+200+250+300+350+400+400 = 2200
    expect(levelForXp(2200)).toMatchObject({ level: 10, xpIntoLevel: 0 });
  });
  it("отрицательный/дробный XP клампится", () => {
    expect(levelForXp(-5)).toMatchObject({ level: 1, xpIntoLevel: 0 });
    expect(levelForXp(60.9)).toMatchObject({ level: 2, xpIntoLevel: 10 });
  });
});

describe("skillLevel: max(1, floor(pct/10))", () => {
  it("0% — уровень 1 (без ур.0)", () => expect(skillLevel(0)).toBe(1));
  it("18% — уровень 1", () => expect(skillLevel(18)).toBe(1));
  it("55% — уровень 5", () => expect(skillLevel(55)).toBe(5));
  it("100% — уровень 10", () => expect(skillLevel(100)).toBe(10));
});
