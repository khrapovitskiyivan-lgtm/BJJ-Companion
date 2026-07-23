import { describe, it, expect } from "vitest";
import { pendingReview } from "./reviewQueue";
import type { DiaryEntry } from "./types";
import type { ProgressMap } from "./store";

function entry(date: string, ids: number[]): DiaryEntry {
  return { id: date + ids.join(","), date, techniqueIds: ids };
}

// «Сегодня» фиксировано: 16 июля 2026 (чт)
const TODAY = new Date(2026, 6, 16);
const NO_PROGRESS: ProgressMap = {};

describe("pendingReview", () => {
  it("техники из окна попадают, вне окна — нет", () => {
    const entries = [
      entry("2026-07-15", [1]), // в окне
      entry("2026-07-01", [2]), // старше 7 дней
    ];
    expect(pendingReview(entries, {}, NO_PROGRESS, TODAY)).toEqual([1]);
  });

  it("разобранное (reviewed после лога) уходит", () => {
    const entries = [entry("2026-07-15", [1])];
    const shownMs = new Date(2026, 6, 15).getTime();
    // открыл карточку позже лога -> не в очереди
    expect(pendingReview(entries, { 1: shownMs + 1000 }, NO_PROGRESS, TODAY)).toEqual([]);
    // открывал ДО лога -> всё ещё в очереди
    expect(pendingReview(entries, { 1: shownMs - 1000 }, NO_PROGRESS, TODAY)).toEqual([1]);
  });

  it("повторный лог возвращает разобранную технику", () => {
    // разобрал 10-го, снова показали 15-го
    const reviewedMs = new Date(2026, 6, 10).getTime();
    const entries = [entry("2026-07-15", [1])];
    expect(pendingReview(entries, { 1: reviewedMs }, NO_PROGRESS, TODAY)).toEqual([1]);
  });

  it("изученная (done) не попадает", () => {
    const entries = [entry("2026-07-15", [1, 2])];
    expect(pendingReview(entries, {}, { 1: "done" }, TODAY)).toEqual([2]);
  });

  it("caughtBy не учитывается", () => {
    const e: DiaryEntry = { id: "x", date: "2026-07-15", techniqueIds: [1], caughtBy: [9] };
    expect(pendingReview([e], {}, NO_PROGRESS, TODAY)).toEqual([1]);
  });

  it("свежие сверху и кап", () => {
    const entries = [entry("2026-07-16", [3]), entry("2026-07-14", [1, 2])];
    expect(pendingReview(entries, {}, NO_PROGRESS, TODAY, 7, 2)).toEqual([3, 1]);
  });
});
