import { describe, it, expect } from "vitest";
import { staleToRepeat } from "./insights";
import type { DiaryEntry } from "./types";
import type { ProgressMap } from "./store";

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
