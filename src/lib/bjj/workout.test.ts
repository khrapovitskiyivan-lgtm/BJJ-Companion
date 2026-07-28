import { describe, it, expect } from "vitest";
import { generateWorkout } from "./workout";
import type { StyleProfile, WorkoutConfig } from "./types";

function profile(over: Partial<StyleProfile> = {}): StyleProfile {
  return { belt: "blue", gi: true, noGi: true, theme: "light", locale: "ru", onboardingDone: true, ...over };
}
const config: WorkoutConfig = { duration: 45, safety: "smart", intensity: "medium", focus: "all" };

const ids = (w: ReturnType<typeof generateWorkout>) => w.drills.map((d) => d.technique.id);
const escapes = (w: ReturnType<typeof generateWorkout>) =>
  w.drills.filter((d) => d.technique.group === "escape" || d.technique.group === "retention").length;

describe("generateWorkout: влияние цели", () => {
  it("goal смещает подбор: health и competition дают разный набор", () => {
    const health = generateWorkout(config, profile({ goal: "health" }));
    const comp = generateWorkout(config, profile({ goal: "competition" }));
    expect(ids(health)).not.toEqual(ids(comp));
  });

  it("health поднимает долю побегов/ретеншна не ниже, чем competition", () => {
    expect(escapes(generateWorkout(config, profile({ goal: "health" })))).toBeGreaterThanOrEqual(
      escapes(generateWorkout(config, profile({ goal: "competition" }))),
    );
  });
});
