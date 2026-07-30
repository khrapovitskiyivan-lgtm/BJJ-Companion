import { describe, it, expect } from "vitest";
import { gapState } from "./gapState";
import type { StyleScore } from "./styleProfile";
import type { Style } from "./types";

const sc = (style: Style, pct = 50): StyleScore => ({ style, score: 1, pct, done: 3 });
const top = [sc("back_hunter" as Style)];

describe("gapState", () => {
  it("холодный старт (мало done) -> hidden", () => {
    expect(gapState({ scores: top, doneCount: 2, mounted: true, dismissed: false })).toBe("hidden");
  });
  it("нет данных стиля (scores пусто) -> hidden", () => {
    expect(gapState({ scores: [], doneCount: 10, mounted: true, dismissed: false })).toBe("hidden");
  });
  it("порог пройден, аспирация пуста, mounted -> prompt", () => {
    expect(gapState({ scores: top, doneCount: 10, mounted: true, dismissed: false })).toBe("prompt");
  });
  it("до mount -> hidden (SSR-safe)", () => {
    expect(gapState({ scores: top, doneCount: 10, mounted: false, dismissed: false })).toBe("hidden");
  });
  it("дисмисснут -> hidden", () => {
    expect(gapState({ scores: top, doneCount: 10, mounted: true, dismissed: true })).toBe("hidden");
  });
  it("аспирация совпала с топом -> ontrack", () => {
    expect(gapState({ scores: top, preferredStyles: ["back_hunter" as Style], doneCount: 10, mounted: true, dismissed: false })).toBe("ontrack");
  });
  it("аспирация не совпала -> gap", () => {
    expect(gapState({ scores: top, preferredStyles: ["sweeper" as Style], doneCount: 10, mounted: true, dismissed: false })).toBe("gap");
  });
});
