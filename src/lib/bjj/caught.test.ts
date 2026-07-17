import { describe, it, expect } from "vitest";
import { caughtCounts, topCatchers, defensesFor } from "./caught";
import { TECHNIQUES } from "./data";
import type { DiaryEntry } from "./types";

function entry(date: string, caughtBy?: number[]): DiaryEntry {
  return { id: date + Math.random(), date, techniqueIds: [1], caughtBy };
}

describe("caughtCounts", () => {
  it("складывает по записям, пустые caughtBy не мешают", () => {
    const map = caughtCounts([entry("2026-07-01", [5, 7]), entry("2026-07-03", [5]), entry("2026-07-05")]);
    expect(map.get(5)).toBe(2);
    expect(map.get(7)).toBe(1);
    expect(map.size).toBe(2);
  });
});

describe("topCatchers", () => {
  it("один раз — случайность, не показываем; сортировка по числу", () => {
    const entries = [
      entry("2026-07-01", [5, 7]),
      entry("2026-07-03", [5, 9]),
      entry("2026-07-05", [5, 9]),
    ];
    const top = topCatchers(entries);
    expect(top).toEqual([
      { id: 5, count: 3 },
      { id: 9, count: 2 },
    ]);
  });

  it("пустой дневник — пусто", () => {
    expect(topCatchers([])).toEqual([]);
  });
});

describe("defensesFor", () => {
  // Реальные данные: «Треугольник из гарда» и его защиты через setup_from
  const triangle = TECHNIQUES.find((t) => t.nameRu === "Треугольник из гарда");

  it("находит защиту от треугольника, побеги первыми", () => {
    expect(triangle).toBeDefined();
    const defs = defensesFor(triangle!.id, TECHNIQUES);
    expect(defs.length).toBeGreaterThan(0);
    expect(defs.some((t) => t.nameRu === "Защита от треугольника")).toBe(true);
    // побеги раньше прочих групп
    const firstNonEscape = defs.findIndex((t) => t.group !== "escape");
    const lastEscape = defs.map((t) => t.group).lastIndexOf("escape");
    if (firstNonEscape !== -1 && lastEscape !== -1) {
      expect(lastEscape).toBeLessThan(firstNonEscape === -1 ? Infinity : firstNonEscape + defs.length);
      expect(defs[0].group).toBe("escape");
    }
  });

  it("у техники без входящих защит — пусто", () => {
    // id, которого нет ни в одном setup_from: возьмём заведомо несуществующий
    expect(defensesFor(-1, TECHNIQUES)).toEqual([]);
  });
});
