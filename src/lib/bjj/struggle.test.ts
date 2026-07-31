import { describe, it, expect } from "vitest";
import { showStruggle, STRUGGLE_TAGS, STRUGGLE_LABEL } from "./struggle";

describe("showStruggle: гейт по сигналу сопротивления", () => {
  it("быстрый лог (нет поймали/интенсивности/раундов) — скрыт", () => {
    expect(showStruggle({ caught: [], intensity: null, rounds: 0 })).toBe(false);
  });
  it("есть 'чем поймали' — показан", () => {
    expect(showStruggle({ caught: [100], intensity: null, rounds: 0 })).toBe(true);
  });
  it("задана интенсивность — показан", () => {
    expect(showStruggle({ caught: [], intensity: "hard", rounds: 0 })).toBe(true);
  });
  it("есть раунды — показан", () => {
    expect(showStruggle({ caught: [], intensity: null, rounds: 3 })).toBe(true);
  });
});

describe("подписи струггла", () => {
  it("на каждый тег есть непустая подпись", () => {
    for (const tag of STRUGGLE_TAGS) {
      expect(STRUGGLE_LABEL[tag]).toBeTruthy();
    }
  });
});
