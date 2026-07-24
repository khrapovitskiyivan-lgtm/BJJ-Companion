import { describe, it, expect } from "vitest";
import { levelForXp, skillLevel, entryXp, isGrowthTech, computeTotalXp, computeEntryXpReward } from "./xp";
import type { Style, Technique } from "./types";

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
const P = "pressure_passer" as Style;
const O = "open_guard" as Style;

describe("levelForXp: пороги min(50*L, 400)", () => {
  it("0 XP - уровень 1, до следующего 50", () => {
    expect(levelForXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForLevel: 50, xpToNext: 50 });
  });
  it("50 XP - ровно уровень 2", () => {
    expect(levelForXp(50)).toEqual({ level: 2, xpIntoLevel: 0, xpForLevel: 100, xpToNext: 100 });
  });
  it("60 XP - уровень 2, 10 внутри", () => {
    expect(levelForXp(60)).toMatchObject({ level: 2, xpIntoLevel: 10, xpForLevel: 100, xpToNext: 90 });
  });
  it("150 XP - уровень 3 (50+100)", () => {
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
  it("0% - уровень 1 (без ур.0)", () => expect(skillLevel(0)).toBe(1));
  it("18% - уровень 1", () => expect(skillLevel(18)).toBe(1));
  it("55% - уровень 5", () => expect(skillLevel(55)).toBe(5));
  it("100% - уровень 10", () => expect(skillLevel(100)).toBe(10));
});

describe("isGrowthTech: инверсия по поясу", () => {
  it("белый: техника ВНЕ топ-архетипа даёт бонус", () => {
    expect(isGrowthTech(tech(1, { styles: [O] }), "white", P)).toBe(true);
    expect(isGrowthTech(tech(2, { styles: [P] }), "white", P)).toBe(false);
  });
  it("синий+: техника В топ-архетипе даёт бонус", () => {
    expect(isGrowthTech(tech(3, { styles: [P] }), "blue", P)).toBe(true);
    expect(isGrowthTech(tech(4, { styles: [O] }), "purple", P)).toBe(false);
  });
  it("без топ-архетипа бонуса нет", () => {
    expect(isGrowthTech(tech(5, { styles: [P] }), "white", null)).toBe(false);
  });
});

describe("entryXp: база + техники (кап 3) + поясной бонус (кап 3)", () => {
  const byId = new Map([1, 2, 3, 4].map((id) => [id, tech(id, { styles: [O] })]));
  it("одна техника вне архетипа у белого: 20 + 10 + 10", () => {
    const r = entryXp([1], { belt: "white", topStyle: P, byId });
    expect(r).toMatchObject({ base: 20, techniques: 10, beltBonus: 10, bonusCount: 1, total: 40 });
  });
  it("капы: 5 техник -> техники max 30, бонус max 30", () => {
    const many = new Map(Array.from({ length: 5 }, (_, i) => [i + 1, tech(i + 1, { styles: [O] })]));
    const r = entryXp([1, 2, 3, 4, 5], { belt: "white", topStyle: P, byId: many });
    expect(r).toMatchObject({ techniques: 30, beltBonus: 30, total: 80 });
  });
});

// computeStyleAffinity (в topStyleOf) считает по ГЛОБАЛЬНОЙ базе TECHNIQUES, а не по
// переданному массиву. Чтобы топ-архетип был детерминированно null (без поясного бонуса),
// используем id, которых нет в реальной базе -> аффинити пусто -> topStyle null.
describe("computeTotalXp: сумма записей + разбор", () => {
  const techs = [tech(90001, { styles: [O] }), tech(90002, { styles: [O] })];
  it("две записи по одной технике + одна разобранная (topStyle null)", () => {
    const total = computeTotalXp({
      entries: [
        { id: "a", date: "2026-07-10", techniqueIds: [90001] },
        { id: "b", date: "2026-07-11", techniqueIds: [90002] },
      ],
      progress: {},
      belt: "white",
      techniques: techs,
      reviewed: { 90001: 123 },
    });
    // topStyle null -> поясного бонуса нет. Каждая запись: 20 + 10 = 30; две = 60;
    // разбор 1*10 = 10; итого 70
    expect(total).toBe(70);
  });
});

// Те же id вне реальной базы -> topStyle null -> delta без поясного бонуса (детерминированно).
describe("computeEntryXpReward: дельта и level-up", () => {
  const techs = [tech(90001, { styles: [O] }), tech(90002, { styles: [O] })];
  it("первая запись: delta 30, без level-up (порог 50)", () => {
    const r = computeEntryXpReward({
      entriesBefore: [],
      entry: { date: "2026-07-15", techniqueIds: [90001] },
      progressBefore: {},
      techniques: techs,
      belt: "white",
      reviewed: {},
    });
    expect(r).toMatchObject({ delta: 30, leveledUp: false, level: 1 });
  });
  it("вторая запись пересекает 50 -> level-up на 2", () => {
    const r = computeEntryXpReward({
      entriesBefore: [{ id: "a", date: "2026-07-14", techniqueIds: [90001] }],
      entry: { date: "2026-07-15", techniqueIds: [90002] },
      progressBefore: {},
      techniques: techs,
      belt: "white",
      reviewed: {},
    });
    expect(r).toMatchObject({ delta: 30, leveledUp: true, level: 2, xpIntoLevel: 10 });
  });
});
