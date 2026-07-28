import { describe, it, expect } from "vitest";
import { submissionRegion, reverseCandidates } from "./reverseSearch";
import type { Technique } from "./types";

function t(id: number, over: Partial<Technique> = {}): Technique {
  return {
    id, label: `t${id}`, title: `t${id}`, nameRu: `t${id}`, nameEn: `t${id}`,
    group: "submission", belt: "white", styles: [], gi: true, noGi: true,
    legal_ibjjf_gi: true, legal_ibjjf_nogi: true, legal_adcc: true,
    points_ibjjf: 0, points_adcc: 0, tags: [], prerequisites: [],
    setup_from: [], common_setups: [], chain_to: [], difficulty: 1,
    successRate: "N/A", energyCost: "Low", content: {}, ...over,
  };
}

describe("submissionRegion", () => {
  it("шея: удушения/треугольники", () => {
    expect(submissionRegion(t(1, { nameRu: "Удушение сзади" }))).toBe("neck");
    expect(submissionRegion(t(2, { nameRu: "Треугольник из гарда" }))).toBe("neck");
    expect(submissionRegion(t(3, { nameRu: "Гильотина из гарда" }))).toBe("neck");
  });
  it("рука: рычаги локтя/кимуры", () => {
    expect(submissionRegion(t(4, { nameRu: "Рычаг локтя из гарда" }))).toBe("arm");
    expect(submissionRegion(t(5, { nameRu: "Кимура из гарда" }))).toBe("arm");
    expect(submissionRegion(t(6, { nameRu: "Рычаг запястья", nameEn: "Wristlock" }))).toBe("arm");
  });
  it("нога: ножные замки", () => {
    expect(submissionRegion(t(7, { nameRu: "Скручивание пятки", nameEn: "Heel Hook" }))).toBe("leg");
    expect(submissionRegion(t(8, { nameRu: "Рычаг колена", nameEn: "Kneebar" }))).toBe("leg");
    expect(submissionRegion(t(9, { nameRu: "Прямой рычаг голеностопа" }))).toBe("leg");
  });
});

describe("reverseCandidates", () => {
  const techs = [
    t(1, { nameRu: "Удушение сзади", difficulty: 2 }),
    t(2, { nameRu: "Треугольник", difficulty: 3 }),
    t(3, { nameRu: "Рычаг локтя", difficulty: 1 }),
    t(10, { nameRu: "Креветка", group: "escape", setup_from: [13] }),
    t(11, { nameRu: "Мост из маунта", group: "escape", setup_from: [15] }),
    t(20, { nameRu: "Проход в обе ноги", group: "takedown", difficulty: 2 }),
    t(30, { nameRu: "Свип ножницы", group: "sweep", difficulty: 1 }),
    t(40, { nameRu: "Проход коленом", group: "guard_pass", difficulty: 2 }),
  ];

  it("сабмишен + шея -> только удушения, простое первым", () => {
    const out = reverseCandidates(techs, { scenario: "submission", region: "neck" });
    expect(out.map((x) => x.id)).toEqual([1, 2]); // 3 - рука, не попадает
  });

  it("выход + позиция -> эскейпы из этой позиции", () => {
    const out = reverseCandidates(techs, { scenario: "escape", fromPosition: 13 });
    expect(out.map((x) => x.id)).toEqual([10]);
  });

  it("тейкдаун -> броски", () => {
    const out = reverseCandidates(techs, { scenario: "takedown" });
    expect(out.map((x) => x.id)).toEqual([20]);
  });

  it("свип -> перевороты снизу", () => {
    expect(reverseCandidates(techs, { scenario: "sweep" }).map((x) => x.id)).toEqual([30]);
  });

  it("проход гарда -> проходы", () => {
    expect(reverseCandidates(techs, { scenario: "pass" }).map((x) => x.id)).toEqual([40]);
  });
});
