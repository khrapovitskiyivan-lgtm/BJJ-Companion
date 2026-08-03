import { describe, it, expect } from "vitest";
// Пайплайн-хелпер лежит в scripts/ (импортируется build-data.mjs, который не читает TS).
import { deriveVideoAccess } from "../../../scripts/deriveVideoAccess.mjs";

describe("deriveVideoAccess", () => {
  it("нет override, техника в стартовом наборе -> demo", () => {
    expect(deriveVideoAccess(undefined, true)).toBe("demo");
  });
  it("нет override, техника вне набора -> pro", () => {
    expect(deriveVideoAccess(undefined, false)).toBe("pro");
  });
  it("override pro перебивает членство в наборе", () => {
    expect(deriveVideoAccess("pro", true)).toBe("pro");
  });
  it("override demo перебивает отсутствие в наборе", () => {
    expect(deriveVideoAccess("demo", false)).toBe("demo");
  });
  it("невалидный override игнорируется, падаем на членство", () => {
    expect(deriveVideoAccess("free", true)).toBe("demo");
  });
});
