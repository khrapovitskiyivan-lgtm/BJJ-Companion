import { describe, it, expect } from "vitest";
import {
  effectiveStyleSet,
  practiceCountFrom,
  pickAnchor,
  recentDiaryIds,
  buildCluster,
  clusterMinutes,
  themeReason,
} from "./workoutCluster";
import type { DiaryEntry, StyleProfile, Style, Technique } from "./types";
import type { FavoritesMap } from "./store";

// Полная синтетическая техника с переопределениями (id вне базы)
export function T(over: Partial<Technique> = {}): Technique {
  return {
    id: 1,
    label: "T",
    title: "T",
    nameRu: "T",
    nameEn: "T",
    group: "submission",
    belt: "white",
    styles: [],
    gi: true,
    noGi: true,
    legal_ibjjf_gi: true,
    legal_ibjjf_nogi: true,
    legal_adcc: true,
    points_ibjjf: 0,
    points_adcc: 0,
    tags: [],
    aliases: [],
    prerequisites: [],
    setup_from: [],
    common_setups: [],
    chain_to: [],
    difficulty: 2,
    successRate: "N/A",
    energyCost: "Low",
    content: {
      ru: { concept: "", mechanics: "", keyPoints: "", when: "", mistakes: "", drills: "", injuryRisk: "Низкий", tapWarning: "Нет" },
    },
    ...over,
  } as Technique;
}
const prof = (over: Partial<StyleProfile> = {}): StyleProfile => ({
  belt: "blue",
  gi: true,
  noGi: true,
  theme: "light",
  locale: "ru",
  onboardingDone: true,
  ...over,
});

describe("effectiveStyleSet", () => {
  it("preferredStyles приоритетнее выведенного", () => {
    const s = effectiveStyleSet(prof({ preferredStyles: ["back_hunter" as Style] }), {}, {});
    expect(s.has("back_hunter" as Style)).toBe(true);
    expect(s.size).toBe(1);
  });
  it("пустой preferredStyles -> пустой набор при пустой активности", () => {
    expect(effectiveStyleSet(prof(), {}, {}).size).toBe(0);
  });
});

describe("practiceCountFrom", () => {
  it("считает повторы техник в записях", () => {
    const entries: DiaryEntry[] = [
      { id: "a", date: "2026-07-01", techniqueIds: [10, 20] },
      { id: "b", date: "2026-07-02", techniqueIds: [10] },
    ];
    expect(practiceCountFrom(entries)).toEqual({ 10: 2, 20: 1 });
  });
});

describe("pickAnchor", () => {
  const base = { entries: [] as DiaryEntry[], styleSet: new Set<Style>(), source: "profile" as const };
  it("избранное бьёт in_progress", () => {
    const av = [T({ id: 10 }), T({ id: 20 })];
    const fav: FavoritesMap = { 20: true };
    const a = pickAnchor({ ...base, available: av, favorites: fav, progress: { 10: "in_progress" } });
    expect(a?.id).toBe(20);
  });
  it("инвариант доверия: goal=health не выкидывает избранный лег-лок-якорь", () => {
    const legFav = T({ id: 30, tags: ["leg_locks"], group: "submission" });
    const escape = T({ id: 40, group: "escape" });
    const a = pickAnchor({ ...base, available: [legFav, escape], favorites: { 30: true }, progress: {}, goal: "health" });
    expect(a?.id).toBe(30); // избранное (tier) выше goalScore-штрафа
  });
  it("avoidId исключается (ротация)", () => {
    const av = [T({ id: 10 }), T({ id: 20 })];
    const a = pickAnchor({ ...base, available: av, favorites: { 10: true, 20: true }, progress: {}, avoidId: 10 });
    expect(a?.id).toBe(20);
  });
  it("пустой пул -> null (холодный старт)", () => {
    const a = pickAnchor({ ...base, available: [T({ id: 10 })], favorites: {}, progress: {} });
    expect(a).toBeNull();
  });
  it("diary-источник берёт свежую технику из дневника", () => {
    const av = [T({ id: 10 }), T({ id: 99 })];
    const entries: DiaryEntry[] = [{ id: "a", date: "2026-07-30", techniqueIds: [99] }];
    const a = pickAnchor({ available: av, favorites: {}, progress: {}, entries, styleSet: new Set(), source: "diary" });
    expect(a?.id).toBe(99);
  });
});

describe("recentDiaryIds", () => {
  it("учитывает записи в окне и игнорирует старые", () => {
    const today = new Date(2026, 6, 31); // 2026-07-31
    const entries: DiaryEntry[] = [
      { id: "a", date: "2026-07-20", techniqueIds: [1] },
      { id: "b", date: "2026-01-01", techniqueIds: [2] },
    ];
    const ids = recentDiaryIds(entries, 21, today);
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(false);
  });
});

describe("buildCluster", () => {
  it("порядок вход -> якорь -> продолжение; всё из available", () => {
    const entry = T({ id: 1, group: "position" });
    const anchor = T({ id: 2, setup_from: [1], chain_to: [3], group: "submission" });
    const follow = T({ id: 3, group: "submission" });
    const cl = buildCluster({ anchor, available: [entry, anchor, follow], styleSet: new Set(), count: 5 });
    expect(cl.map((t) => t.id)).toEqual([1, 2, 3]);
  });
  it("тонкий якорь (нет chain_to/родни) не даёт «поток из 1» — добор из available", () => {
    const anchor = T({ id: 2, setup_from: [], chain_to: [], group: "submission" });
    const other = T({ id: 9, group: "sweep" });
    const cl = buildCluster({ anchor, available: [anchor, other], styleSet: new Set(), count: 3 });
    expect(cl.length).toBe(2);
    expect(cl[0].id).toBe(2);
  });
  it("родня: та же группа + общий вход с якорем", () => {
    const anchor = T({ id: 2, setup_from: [1], chain_to: [], group: "sweep" });
    const kin = T({ id: 5, setup_from: [1], group: "sweep" }); // общий вход 1, та же группа
    const notKin = T({ id: 6, setup_from: [7], group: "sweep" }); // другой вход
    const cl = buildCluster({ anchor, available: [anchor, kin, notKin], styleSet: new Set(), count: 2 });
    expect(cl.map((t) => t.id)).toEqual([2, 5]);
  });
  it("цикл в графе не зависает и уважает count", () => {
    const a = T({ id: 2, chain_to: [3], setup_from: [] });
    const b = T({ id: 3, chain_to: [2], setup_from: [] }); // цикл 2<->3
    const cl = buildCluster({ anchor: a, available: [a, b], styleSet: new Set(), count: 5 });
    expect(cl.map((t) => t.id)).toEqual([2, 3]);
  });
});

describe("clusterMinutes", () => {
  it("сумма = mainMinutes, минимум 2, новому больше знакомого", () => {
    const cl = [T({ id: 1 }), T({ id: 2 })];
    const mins = clusterMinutes(cl, 20, { 2: "done" }, { 2: 5 });
    expect(mins.reduce((a, b) => a + b, 0)).toBe(20);
    expect(Math.min(...mins)).toBeGreaterThanOrEqual(2);
    expect(mins[0]).toBeGreaterThan(mins[1]); // id1 not_started > id2 done+практикован
  });
});

describe("themeReason", () => {
  const byId = new Map<number, Technique>();
  it("избранное", () => {
    expect(themeReason({ anchor: T({ id: 1 }), favorites: { 1: true }, progress: {}, entries: [], byId })).toBe("Твой избранный приём");
  });
  it("в процессе", () => {
    expect(themeReason({ anchor: T({ id: 1 }), favorites: {}, progress: { 1: "in_progress" }, entries: [], byId })).toBe("Ты это учишь");
  });
  it("холодный старт", () => {
    expect(themeReason({ anchor: T({ id: 1 }), favorites: {}, progress: {}, entries: [], byId })).toBe("Основа под твой пояс");
  });
});
