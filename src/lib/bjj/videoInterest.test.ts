import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./telemetry", () => ({ track: vi.fn() }));
import { track } from "./telemetry";
import { hasVideoInterest, markVideoInterest } from "./videoInterest";

describe("videoInterest", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("false до тапа", () => {
    expect(hasVideoInterest(32)).toBe(false);
  });

  it("mark делает интерес true и шлёт событие с id", () => {
    markVideoInterest(32);
    expect(hasVideoInterest(32)).toBe(true);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("pro_video_interest", "32");
  });

  it("повторный mark того же id не шлёт событие (дедуп)", () => {
    markVideoInterest(32);
    markVideoInterest(32);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("разные техники независимы и переживают перезагрузку", () => {
    markVideoInterest(32);
    expect(hasVideoInterest(32)).toBe(true);
    expect(hasVideoInterest(33)).toBe(false);
    const raw = localStorage.getItem("bjj.videoInterest.v1");
    expect(JSON.parse(raw as string)).toEqual([32]);
  });
});
