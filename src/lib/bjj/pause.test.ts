import { describe, it, expect } from "vitest";
import { activePause, isPausedOn, weekOverlapsPause } from "./pause";
import type { PausePeriod } from "./types";

const P = (p: PausePeriod[]) => p;

describe("activePause", () => {
  it("без пауз -> null", () => {
    expect(activePause(undefined, "2026-08-10")).toBeNull();
  });
  it("открытая пауза (нет to, нет until) -> активна", () => {
    const p = P([{ from: "2026-08-03" }]);
    expect(activePause(p, "2026-08-10")).toEqual({ from: "2026-08-03" });
  });
  it("с датой возврата в будущем -> активна", () => {
    const p = P([{ from: "2026-08-03", until: "2026-08-20" }]);
    expect(activePause(p, "2026-08-10")?.from).toBe("2026-08-03");
  });
  it("дата возврата прошла -> авто-снята, null", () => {
    const p = P([{ from: "2026-08-03", until: "2026-08-08" }]);
    expect(activePause(p, "2026-08-10")).toBeNull();
  });
  it("закрытая (есть to) -> null", () => {
    const p = P([{ from: "2026-08-03", to: "2026-08-06" }]);
    expect(activePause(p, "2026-08-10")).toBeNull();
  });
});

describe("isPausedOn", () => {
  const open = P([{ from: "2026-08-03" }]);
  it("день внутри открытой паузы (from..today) -> true", () => {
    expect(isPausedOn("2026-08-05", open, "2026-08-10")).toBe(true);
  });
  it("день до начала -> false", () => {
    expect(isPausedOn("2026-08-01", open, "2026-08-10")).toBe(false);
  });
  it("день после авто-снятия по until -> false", () => {
    const p = P([{ from: "2026-08-03", until: "2026-08-08" }]);
    expect(isPausedOn("2026-08-09", p, "2026-08-10")).toBe(false);
  });
  it("день в закрытом интервале [from,to] -> true", () => {
    const p = P([{ from: "2026-08-03", to: "2026-08-06" }]);
    expect(isPausedOn("2026-08-04", p, "2026-08-10")).toBe(true);
  });
});

describe("weekOverlapsPause", () => {
  const week = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"];
  it("неделя с паузным днём -> true", () => {
    expect(weekOverlapsPause(week, P([{ from: "2026-08-05", to: "2026-08-05" }]), "2026-08-20")).toBe(true);
  });
  it("неделя вне паузы -> false", () => {
    expect(weekOverlapsPause(week, P([{ from: "2026-09-01" }]), "2026-09-10")).toBe(false);
  });
});
