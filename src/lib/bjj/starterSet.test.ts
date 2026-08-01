import { describe, it, expect } from "vitest";
import { starterProgress, type StarterBucket } from "./starterSet";
import type { ProgressMap } from "./store";

// Реальные белые id из базы (существуют в TECH_BY_ID)
const SET: StarterBucket[] = [
  { title: "Гард снизу", ids: [1, 70] },
  { title: "Выходы", ids: [132, 133] },
];

describe("starterProgress", () => {
  it("пустой прогресс -> done 0, total = число валидных id", () => {
    const r = starterProgress({}, SET);
    expect(r.done).toBe(0);
    expect(r.total).toBe(4);
    expect(r.buckets).toHaveLength(2);
    expect(r.buckets[0].techniques).toHaveLength(2);
  });

  it("частичный прогресс -> счётчики по бакетам и итог согласованы", () => {
    const progress: ProgressMap = { 1: "done", 70: "in_progress", 132: "done" };
    const r = starterProgress(progress, SET);
    expect(r.done).toBe(2);
    expect(r.buckets[0].done).toBe(1); // 1 done, 70 in_progress не считается
    expect(r.buckets[1].done).toBe(1); // 132 done, 133 нет
    expect(r.done).toBe(r.buckets.reduce((n, b) => n + b.done, 0));
  });

  it("несуществующий id пропускается, не роняет", () => {
    const r = starterProgress({}, [{ title: "X", ids: [1, 999999] }]);
    expect(r.total).toBe(1);
    expect(r.buckets[0].techniques).toHaveLength(1);
  });
});
