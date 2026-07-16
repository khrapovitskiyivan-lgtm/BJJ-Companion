import { describe, it, expect } from "vitest";
import { nextToLearn, nextForStyle } from "./recommend";
import type { Technique } from "./types";

// Фабрика синтетической техники: все обязательные поля, переопределяем нужное
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

describe("nextToLearn с целью", () => {
  it("self-defense поднимает escape выше submission при равных прочих", () => {
    const ts = [
      tech(1, { group: "submission" }),
      tech(2, { group: "escape" }),
    ];
    const out = nextToLearn(ts, {}, "white", 2, { goal: "self-defense" });
    expect(out[0].id).toBe(2);
  });

  it("competition поднимает очковую легальную технику", () => {
    const ts = [
      tech(1, { points_ibjjf: 0 }),
      tech(2, { points_ibjjf: 4 }),
    ];
    const out = nextToLearn(ts, {}, "white", 2, { goal: "competition", gi: true });
    expect(out[0].id).toBe(2);
  });

  it("без цели порядок прежний (пояс, сложность)", () => {
    const ts = [
      tech(1, { difficulty: 2 }),
      tech(2, { difficulty: 1 }),
    ];
    const out = nextToLearn(ts, {}, "white", 2);
    expect(out[0].id).toBe(2);
  });
});

describe("nextForStyle", () => {
  it("возвращает только не начатые разблокированные техники стиля", () => {
    const ts = [
      tech(1, { styles: ["leg_game"] }),
      tech(2, { styles: ["leg_game"] }),
      tech(3, { styles: ["closed_guard"] }),
    ];
    const out = nextForStyle(ts, { 1: "done" }, "white", "leg_game", 3);
    expect(out.map((t) => t.id)).toEqual([2]);
  });
});
