import { describe, it, expect } from "vitest";
import { buildPublishInput } from "./partnersProfile";
import type { StyleProfile } from "./types";

const profile: StyleProfile = {
  belt: "white",
  gi: true,
  noGi: false,
  theme: "light",
  locale: "ru",
  onboardingDone: true,
};

describe("buildPublishInput: уровень игрока в публикации", () => {
  it("возвращает числовой level >= 1", () => {
    const out = buildPublishInput({
      device: "dev1",
      profile,
      progress: {},
      practiceCount: {},
      entries: [{ id: "a", date: "2026-07-10", techniqueIds: [1] }],
      reviewed: {},
      today: new Date(2026, 6, 15),
    });
    expect(typeof out.level).toBe("number");
    expect(out.level).toBeGreaterThanOrEqual(1);
  });

  it("больше записей — уровень не ниже", () => {
    const base = { device: "dev1", profile, progress: {}, practiceCount: {}, reviewed: {}, today: new Date(2026, 6, 15) };
    const few = buildPublishInput({ ...base, entries: [{ id: "a", date: "2026-07-10", techniqueIds: [1] }] });
    const many = buildPublishInput({
      ...base,
      entries: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, date: `2026-07-1${i}`, techniqueIds: [1] })),
    });
    expect(many.level).toBeGreaterThanOrEqual(few.level);
  });
});
