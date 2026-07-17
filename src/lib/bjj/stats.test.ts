import { describe, it, expect } from "vitest";
import { computeStatsFor, deriveArchetypeStats, countDone, ARCHETYPE_MIN_DONE } from "./stats";
import type { Technique } from "./types";

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

describe("computeStatsFor", () => {
  it("процент от доступного по стату: 1 done из 2 speed-техник = 50", () => {
    const ts = [tech(1, { tags: ["speed"] }), tech(2, { tags: ["speed"] })];
    const out = computeStatsFor(ts, { 1: "done" }, {});
    const speed = out.find((s) => s.stat === "speed")!;
    expect(speed.pct).toBe(50);
    expect(speed.done).toBe(1);
    expect(speed.total).toBe(2);
  });

  it("отработки в дневнике добавляют вес, но pct не выше 100", () => {
    const ts = [tech(1, { tags: ["speed"] })];
    const out = computeStatsFor(ts, { 1: "done" }, { 1: 10 });
    expect(out.find((s) => s.stat === "speed")!.pct).toBe(100);
  });

  it("пустой стат даёт pct 0, не NaN", () => {
    const out = computeStatsFor([tech(1)], {}, {});
    for (const s of out) expect(Number.isNaN(s.pct)).toBe(false);
  });

  it("pctExact дробный, pct — его округление", () => {
    // 10 speed-техник, одна done с одной отработкой: raw 3.5 из 20 = 17.5%
    const ts = Array.from({ length: 10 }, (_, i) => tech(i + 1, { tags: ["speed"] }));
    const out = computeStatsFor(ts, { 1: "done" }, { 1: 1 });
    const speed = out.find((s) => s.stat === "speed")!;
    expect(speed.pctExact).toBeCloseTo(17.5, 5);
    expect(speed.pct).toBe(18);
  });
});

describe("deriveArchetypeStats", () => {
  it("primary стат архетипа = тег с максимальным lift", () => {
    const ts = [
      tech(1, { styles: ["pressure_passer"], tags: ["pressure"] }),
      tech(2, { styles: ["pressure_passer"], tags: ["pressure"] }),
      tech(3, { styles: ["closed_guard"], tags: ["flexibility"] }),
      tech(4, { styles: ["closed_guard"], tags: ["flexibility"] }),
    ];
    const prof = deriveArchetypeStats(ts);
    expect(prof.pressure_passer.primary).toBe("pressure");
    expect(prof.closed_guard.primary).toBe("flexibility");
  });
});

describe("countDone / порог", () => {
  it("считает только done", () => {
    expect(countDone({ 1: "done", 2: "in_progress", 3: "done" })).toBe(2);
  });
  it("порог равен 5", () => {
    expect(ARCHETYPE_MIN_DONE).toBe(5);
  });
});
