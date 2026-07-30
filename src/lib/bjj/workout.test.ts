import { describe, it, expect } from "vitest";
import { generateWorkout, isCriticalTech } from "./workout";
import type { StyleProfile, WorkoutConfig, Technique } from "./types";

function profile(over: Partial<StyleProfile> = {}): StyleProfile {
  return { belt: "blue", gi: true, noGi: true, theme: "light", locale: "ru", onboardingDone: true, ...over };
}
const config: WorkoutConfig = { duration: 45, safety: "smart", intensity: "medium", focus: "all" };

describe("generateWorkout", () => {
  it("генерирует непустой план по профилю (холодный старт)", () => {
    const w = generateWorkout(config, profile({ goal: "health" }), {}, {}, []);
    expect(w.drills.length).toBeGreaterThan(0);
    expect(w.theme).toBeTruthy();
  });
});

function critTech(over: Partial<Technique> = {}): Technique {
  return {
    id: 9001, label: "T", title: "T", nameRu: "T", nameEn: "T", group: "submission",
    belt: "white", styles: [], gi: true, noGi: true, legal_ibjjf_gi: true, legal_ibjjf_nogi: true,
    legal_adcc: true, points_ibjjf: 0, points_adcc: 0, tags: [], aliases: [], prerequisites: [],
    setup_from: [], common_setups: [], chain_to: [], difficulty: 2, successRate: "N/A",
    energyCost: "Low", content: { ru: { concept: "", mechanics: "", keyPoints: "", when: "",
    mistakes: "", drills: "", injuryRisk: "Низкий", tapWarning: "Нет" } }, ...over,
  } as Technique;
}

describe("isCriticalTech", () => {
  it("ловит КРИТИЧНО в injuryRisk", () => {
    expect(isCriticalTech(critTech({ content: { ru: { concept:"",mechanics:"",keyPoints:"",when:"",mistakes:"",drills:"",injuryRisk:"КРИТИЧНО (колено)",tapWarning:"" } } }))).toBe(true);
  });
  it("ловит теги leg_locks и spinal_lock", () => {
    expect(isCriticalTech(critTech({ tags: ["leg_locks"] }))).toBe(true);
    expect(isCriticalTech(critTech({ tags: ["spinal_lock"] }))).toBe(true);
  });
  it("обычную технику не считает критичной", () => {
    expect(isCriticalTech(critTech())).toBe(false);
  });
});
