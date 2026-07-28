import { describe, it, expect } from "vitest";
import { staleToRepeat, computeInsights, primaryAction } from "./insights";
import type { DiaryEntry, Technique, Belt } from "./types";
import type { ProgressMap } from "./store";

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

const TODAY = new Date(2026, 6, 27); // 27 июля 2026

describe("staleToRepeat", () => {
  it("возвращает изученное, чего 3+ недель нет в дневнике; свежее не берёт", () => {
    const entries: DiaryEntry[] = [
      { id: "1", date: "2026-07-26", techniqueIds: [70], caughtBy: [] }, // 70 свежее
      { id: "2", date: "2026-06-20", techniqueIds: [132], caughtBy: [] }, // 132 старое (>3 нед)
    ];
    const progress: ProgressMap = { 70: "done", 132: "done", 200: "done" }; // 200 done, но не в дневнике
    const out = staleToRepeat(entries, progress, TODAY, 21, 5);
    expect(out).toContain(132);
    expect(out).toContain(200);
    expect(out).not.toContain(70);
  });

  it("пустой дневник -> пусто", () => {
    expect(staleToRepeat([], { 200: "done" }, TODAY, 21, 5)).toEqual([]);
  });
});

const base = { belt: "blue" as Belt, techniques: [] as Technique[], today: TODAY };

describe("computeInsights / primaryAction", () => {
  it("нет записей за 7 дней -> primary cold-start (вес 200)", () => {
    const ins = computeInsights({ ...base, entries: [], progress: {}, reviewed: {}, frequency: 3 });
    const pa = primaryAction(ins);
    expect(pa?.kind).toBe("cold-start");
    expect(pa?.weight).toBe(200);
  });

  it("свежий паттерн ловли (2+ в окне) с защитой -> primary catcher-defense", () => {
    const defense = tech(900, { group: "escape", setup_from: [31] });
    const entries: DiaryEntry[] = [
      { id: "1", date: "2026-07-26", techniqueIds: [], caughtBy: [31, 31] },
    ];
    const ins = computeInsights({ ...base, techniques: [defense], entries, progress: {}, reviewed: {}, frequency: 3 });
    const pa = primaryAction(ins);
    expect(pa?.kind).toBe("catcher-defense");
    expect(pa?.techniqueIds).toContain(900);
  });

  it("свежий лог без паттерна, не разобрано -> primary review-shown", () => {
    const entries: DiaryEntry[] = [
      { id: "1", date: "2026-07-27", techniqueIds: [354, 368], caughtBy: [] },
    ];
    const ins = computeInsights({ ...base, entries, progress: {}, reviewed: {}, frequency: 3 });
    expect(primaryAction(ins)?.kind).toBe("review-shown");
  });

  it("catcher вне окна (старый) не перебивает review-shown", () => {
    const defense = tech(900, { group: "escape", setup_from: [31] });
    const entries: DiaryEntry[] = [
      { id: "old", date: "2026-05-01", techniqueIds: [], caughtBy: [31, 31] },
      { id: "new", date: "2026-07-27", techniqueIds: [354], caughtBy: [] },
    ];
    const ins = computeInsights({ ...base, techniques: [defense], entries, progress: {}, reviewed: {}, frequency: 3 });
    expect(primaryAction(ins)?.kind).toBe("review-shown");
  });
});
