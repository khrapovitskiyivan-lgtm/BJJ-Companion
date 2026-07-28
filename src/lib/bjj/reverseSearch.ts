import type { Technique } from "./types";

// Обратный поиск для новичка: «опиши, что со мной случилось» -> кандидаты-техники.
// Работает на существующих данных (group + setup_from + имя/теги), без новых полей и NLP.

export type Scenario = "submission" | "control" | "takedown";
export type Region = "neck" | "arm" | "leg" | "other";

// Классификатор сабмишена по региону атаки. Спец-поля в данных нет - эвристика по
// имени и тегам (проверено спайком: ~95% сабмишенов классифицируются, остаток - ниша).
export function submissionRegion(t: Technique): Region {
  const s = `${t.nameRu} ${t.nameEn} ${t.label} ${t.tags.join(" ")}`.toLowerCase();
  if (/пятк|heel|колен|kneebar|голеност|ankle|аши|калф|икронож|тохолд|toe|банан|бостон краб|ахиллес|эстима|электрическ|leg ?lock|ножн/.test(s)) return "leg";
  if (/рычаг локтя|armbar|кимура|kimura|американ|americana|омоплат|omoplata|запяст|вристлок|ристлок|wristlock|бицепс|bicep|бейби арм|локтя|ude/.test(s)) return "arm";
  if (/удуш|чок|чоук|choke|треугол|triangle|гильотин|guillotin|петля|loop|анаконд|anaconda|дарс|д'арс|darce|галстук|necktie|эзекил|иезекил|ezekiel|брабо|brabo|солья|solja|распят|crucifix|крестов|collar|коллар|clock|часов|бейсбол|baseball|гогоплата|gogoplata|фон флю|von flue|gift|гифт|bow|лук|север-юг|north.?south|rnc|сзади|arm.?triangle|арм-треуг/.test(s)) return "neck";
  return "other";
}

export interface ReverseQuery {
  scenario: Scenario;
  region?: Region;        // для submission (по умолчанию шея)
  fromPosition?: number;  // для control (id позиции, под которой держали)
}

// Кандидаты по описанию. Сортировка по сложности (новичку простое сверху), кап.
export function reverseCandidates(techniques: Technique[], q: ReverseQuery, cap = 8): Technique[] {
  let pool: Technique[];
  if (q.scenario === "submission") {
    const reg = q.region ?? "neck";
    pool = techniques.filter((t) => t.group === "submission" && submissionRegion(t) === reg);
  } else if (q.scenario === "control") {
    // «прижали, не мог двигаться» -> показываем ВЫХОДЫ из этой позиции
    pool = techniques.filter(
      (t) => t.group === "escape" && (q.fromPosition == null || t.setup_from.includes(q.fromPosition)),
    );
  } else {
    pool = techniques.filter((t) => t.group === "takedown");
  }
  return pool
    .slice()
    .sort((a, b) => a.difficulty - b.difficulty || a.id - b.id)
    .slice(0, cap);
}
