import { describe, it, expect } from "vitest";
import { buildTargets, findMatches } from "./glossaryMatch";
import type { GlossaryTerm } from "./glossary";

const GLOSS: GlossaryTerm[] = [
  { term: "Гард", category: "positions", definition: "d" },
  { term: "Закрытый гард", category: "positions", definition: "d" },
  { term: "Давление", category: "principles", definition: "d" },
  { term: "Угол", category: "principles", definition: "d", stems: ["угол", "угл"] },
  { term: "Свип", category: "movement", definition: "d" },
];
const TECHS = [
  { id: 71, nameRu: "Флауэр свип" },
  { id: 100, nameRu: "Треугольник" },
];
const T = buildTargets(GLOSS, TECHS);

function texts(text: string, opts?: Parameters<typeof findMatches>[2]) {
  return findMatches(text, T, opts).map((m) => m.text);
}

describe("findMatches: склонения одиночных терминов", () => {
  it("гарде -> Гард", () => {
    const m = findMatches("работа в гарде важна", T);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ text: "гарде", kind: "glossary" });
    expect(m[0].term?.term).toBe("Гард");
  });
  it("давления -> Давление", () => {
    expect(texts("тут давления много")).toEqual(["давления"]);
  });
  it("свипы -> Свип", () => {
    expect(texts("делаем свипы")).toEqual(["свипы"]);
  });
});

describe("findMatches: беглый гласный через stems", () => {
  it("угол (именительный)", () => expect(texts("хороший угол атаки")).toEqual(["угол"]));
  it("угла (родительный)", () => expect(texts("из-за угла проще")).toEqual(["угла"]));
});

describe("findMatches: границы слова", () => {
  it("гард НЕ ловится внутри гардероб", () => {
    expect(findMatches("шкаф гардероб", T)).toHaveLength(0);
  });
  it("матч в начале и после запятой", () => {
    expect(texts("Гард, потом свип")).toEqual(["Гард", "свип"]);
  });
});

describe("findMatches: longest-first и перекрытия", () => {
  it("закрытого гарда -> целиком Закрытый гард, не Гард", () => {
    const m = findMatches("из закрытого гарда", T);
    expect(m).toHaveLength(1);
    expect(m[0].term?.term).toBe("Закрытый гард");
    expect(m[0].text).toBe("закрытого гарда");
  });
});

describe("findMatches: первое вхождение на термин", () => {
  it("два гарда -> один матч", () => {
    expect(texts("гард и ещё раз гард")).toEqual(["гард"]);
  });
  it("seen переносится между вызовами (per-block)", () => {
    const seen = new Set<string>();
    expect(texts("первый гард", { seen })).toEqual(["гард"]);
    expect(texts("второй гард", { seen })).toEqual([]);
  });
});

describe("findMatches: техника vs концепт", () => {
  it("флауэр свип -> техника (longest-first над Свип)", () => {
    const m = findMatches("покажи флауэр свип сейчас", T);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ kind: "technique", techId: 71 });
    expect(m[0].text).toBe("флауэр свип");
  });
  it("excludeTechId убирает матч своей техники", () => {
    const m = findMatches("флауэр свип", T, { excludeTechId: 71 });
    expect(m.every((x) => x.techId !== 71)).toBe(true);
  });
});
