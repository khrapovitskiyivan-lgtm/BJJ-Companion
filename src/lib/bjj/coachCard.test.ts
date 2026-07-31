import { describe, it, expect } from "vitest";
import { knownCount, nextStep, cardReason } from "./coachCard";
import type { DiaryEntry, Style, Technique } from "./types";

function T(over: Partial<Technique> = {}): Technique {
  return {
    id: 1, label: "T", title: "T", nameRu: "T", nameEn: "T", group: "submission",
    belt: "white", styles: [], gi: true, noGi: true, legal_ibjjf_gi: true, legal_ibjjf_nogi: true,
    legal_adcc: true, points_ibjjf: 0, points_adcc: 0, tags: [], aliases: [], prerequisites: [],
    setup_from: [], common_setups: [], chain_to: [], difficulty: 2, successRate: "N/A",
    energyCost: "Low", content: { ru: { concept: "", mechanics: "", keyPoints: "", when: "", mistakes: "", drills: "", injuryRisk: "Низкий", tapWarning: "Нет" } }, ...over,
  } as Technique;
}
const mapOf = (...ts: Technique[]) => new Map(ts.map((t) => [t.id, t]));

describe("knownCount", () => {
  it("считает освоенные из списка", () => {
    expect(knownCount([1, 2, 3], { 1: "done", 2: "in_progress" })).toEqual({ done: 1, total: 3 });
  });
  it("пустой список -> 0/0", () => {
    expect(knownCount([], {})).toEqual({ done: 0, total: 0 });
  });
});

describe("nextStep", () => {
  it("исключает пройденные продолжения", () => {
    const tech = T({ id: 1, chain_to: [2, 3] });
    const s = nextStep({ tech, byId: mapOf(T({ id: 2 }), T({ id: 3 })), progress: { 2: "done" }, styleSet: new Set() });
    expect(s?.id).toBe(3);
  });
  it("ранг: стиль важнее сложности", () => {
    const tech = T({ id: 1, chain_to: [2, 3] });
    const byId = mapOf(T({ id: 2, difficulty: 1 }), T({ id: 3, difficulty: 5, styles: ["sweeper" as Style] }));
    const s = nextStep({ tech, byId, progress: {}, styleSet: new Set(["sweeper" as Style]) });
    expect(s?.id).toBe(3);
  });
  it("нет непройденных продолжений -> null", () => {
    const tech = T({ id: 1, chain_to: [] });
    expect(nextStep({ tech, byId: mapOf(), progress: {}, styleSet: new Set() })).toBeNull();
  });
});

describe("cardReason", () => {
  const byId = mapOf(T({ id: 9, nameRu: "Треугольник" }));
  it("дыра бьёт стиль", () => {
    const tech = T({ id: 1, setup_from: [9], styles: ["sweeper" as Style] });
    const entries: DiaryEntry[] = [
      { id: "a", date: "2026-07-01", techniqueIds: [], caughtBy: [9] },
      { id: "b", date: "2026-07-02", techniqueIds: [], caughtBy: [9] },
    ];
    const r = cardReason({ tech, entries, styleSet: new Set(["sweeper" as Style]), byId });
    expect(r).toEqual({ kind: "gap", text: "Закрывает твою дыру: Треугольник" });
  });
  it("стиль, если нет дыры", () => {
    const tech = T({ id: 1, styles: ["sweeper" as Style] });
    expect(cardReason({ tech, entries: [], styleSet: new Set(["sweeper" as Style]), byId })).toEqual({ kind: "style", text: "Усиливает твою игру" });
  });
  it("очковая под соревнования", () => {
    const tech = T({ id: 1, points_ibjjf: 2 });
    expect(cardReason({ tech, entries: [], styleSet: new Set(), goal: "competition", byId })).toEqual({ kind: "goal", text: "Очковая под соревнования" });
  });
  it("нет сильной причины -> null (без филлера)", () => {
    expect(cardReason({ tech: T({ id: 1 }), entries: [], styleSet: new Set(), byId })).toBeNull();
  });
});
