import { describe, it, expect } from "vitest";
import { buildStyleShare, buildWeekShare } from "./share";
import type { StyleScore } from "./styleProfile";

const top: StyleScore = { style: "pressure_passer", pct: 42 } as StyleScore;

describe("buildStyleShare", () => {
  it("собирает стиль, процент и прогресс", () => {
    const s = buildStyleShare(top, 12, 293);
    expect(s).toContain("42% игры");
    expect(s).toContain("12 из 293");
    expect(s).toContain("Определи свой:");
  });
});

describe("buildWeekShare", () => {
  it("без частоты — просто счёт", () => {
    expect(buildWeekShare(2, undefined, 0)).toBe("Тренировок BJJ на этой неделе: 2. Веду дневник тут:");
  });

  it("план добит + серия", () => {
    const s = buildWeekShare(3, 3, 4);
    expect(s).toContain("Неделя в плане: 3 из 3");
    expect(s).toContain("серия 4 нед. подряд");
  });

  it("план не добит — без слова «в плане» и без серии из одной недели", () => {
    const s = buildWeekShare(1, 3, 1);
    expect(s).toContain("Неделя: 1 из 3");
    expect(s).not.toContain("в плане");
    expect(s).not.toContain("серия");
  });
});
