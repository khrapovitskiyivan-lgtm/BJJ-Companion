// === XP-ЭКОНОМИКА (выводится, не хранится) ===
// Тотал считается из дневника/прогресса/пояса + локального reviewed. Уровень - из
// порогов cost(L->L+1)=min(50*L,400). Спек docs/superpowers/specs/2026-07-24-xp-economy-design.md.
import { computeStyleAffinity } from "./styleProfile";
import type { Belt, DiaryEntry, Style, Technique } from "./types";
import type { ProgressMap } from "./store";

export const XP_ENTRY = 20;        // за запись тренировки
export const XP_PER_TECH = 10;     // за технику в записи
export const TECH_CAP = 3;         // максимум техник, дающих XP, на запись
export const XP_BELT_BONUS = 10;   // поясной бонус за технику «в направлении роста»
export const BONUS_CAP = 3;        // максимум поясных бонусов на запись
export const XP_PER_REVIEW = 10;   // за отдельную разобранную технику
export const LEVEL_STEP = 50;      // шаг стоимости уровня
export const LEVEL_CAP = 400;      // плато стоимости уровня

// Уровень и позиция внутри него из суммарного XP.
export function levelForXp(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNext: number;
} {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  // защитный кап итераций (в реальности недостижим)
  for (let i = 0; i < 100000; i++) {
    const cost = Math.min(LEVEL_STEP * level, LEVEL_CAP);
    if (remaining < cost) {
      return { level, xpIntoLevel: remaining, xpForLevel: cost, xpToNext: cost - remaining };
    }
    remaining -= cost;
    level++;
  }
  const cost = LEVEL_CAP;
  return { level, xpIntoLevel: 0, xpForLevel: cost, xpToNext: cost };
}

// Скил-уровень из процента освоения стата (переосмысление существующего pct).
export function skillLevel(pct: number): number {
  return Math.max(1, Math.min(10, Math.floor(pct / 10)));
}

// Техника «в направлении роста» для пояса: белый охватывает базу (вне архетипа),
// синий+ специализируется (в архетипе). Без топ-архетипа бонуса нет.
export function isGrowthTech(t: Technique, belt: Belt, topStyle: Style | null): boolean {
  if (!topStyle) return false;
  const inArchetype = t.styles.includes(topStyle);
  return belt === "white" ? !inArchetype : inArchetype;
}

// XP за одну запись дневника: база + техники (кап) + поясной бонус (кап).
export function entryXp(
  techniqueIds: number[],
  opts: { belt: Belt; topStyle: Style | null; byId: Map<number, Technique> },
): { base: number; techniques: number; beltBonus: number; bonusCount: number; total: number } {
  const base = XP_ENTRY;
  const techniques = Math.min(techniqueIds.length, TECH_CAP) * XP_PER_TECH;
  let bonusCount = 0;
  for (const id of techniqueIds) {
    const t = opts.byId.get(id);
    if (t && isGrowthTech(t, opts.belt, opts.topStyle)) bonusCount++;
  }
  bonusCount = Math.min(bonusCount, BONUS_CAP);
  const beltBonus = bonusCount * XP_BELT_BONUS;
  return { base, techniques, beltBonus, bonusCount, total: base + techniques + beltBonus };
}

function practiceFrom(entries: DiaryEntry[]): Record<number, number> {
  const m: Record<number, number> = {};
  for (const e of entries) for (const id of e.techniqueIds) m[id] = (m[id] ?? 0) + 1;
  return m;
}

function topStyleOf(progress: ProgressMap, entries: DiaryEntry[]): Style | null {
  const affinity = computeStyleAffinity(progress, practiceFrom(entries));
  return affinity[0]?.style ?? null; // отсортирован по score desc, отфильтрован score>0
}

// Суммарный XP: сумма записей (текущий пояс/архетип) + разбор показанного.
export function computeTotalXp(input: {
  entries: DiaryEntry[];
  progress: ProgressMap;
  belt: Belt;
  techniques: Technique[];
  reviewed: Record<number, number>;
}): number {
  const { entries, progress, belt, techniques, reviewed } = input;
  const byId = new Map(techniques.map((t) => [t.id, t]));
  const topStyle = topStyleOf(progress, entries);
  let total = 0;
  for (const e of entries) total += entryXp(e.techniqueIds, { belt, topStyle, byId }).total;
  total += Object.keys(reviewed).length * XP_PER_REVIEW;
  return total;
}

export interface EntryXpReward {
  delta: number;
  base: number;
  techniques: number;
  beltBonus: number;
  bonusCount: number;
  leveledUp: boolean;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
}

// XP-награда за сохранённую запись: дельта (лог + техники + поясной бонус) и
// проверка перехода уровня. Разбор показанного сюда НЕ входит (заработается позже).
export function computeEntryXpReward(input: {
  entriesBefore: DiaryEntry[];
  entry: Omit<DiaryEntry, "id">;
  progressBefore: ProgressMap;
  techniques: Technique[];
  belt: Belt;
  reviewed: Record<number, number>;
}): EntryXpReward {
  const { entriesBefore, entry, progressBefore, techniques, belt, reviewed } = input;
  const byId = new Map(techniques.map((t) => [t.id, t]));
  const topStyle = topStyleOf(progressBefore, entriesBefore);
  const ex = entryXp(entry.techniqueIds, { belt, topStyle, byId });
  const totalBefore = computeTotalXp({ entries: entriesBefore, progress: progressBefore, belt, techniques, reviewed });
  const before = levelForXp(totalBefore);
  const after = levelForXp(totalBefore + ex.total);
  return {
    delta: ex.total,
    base: ex.base,
    techniques: ex.techniques,
    beltBonus: ex.beltBonus,
    bonusCount: ex.bonusCount,
    leveledUp: after.level > before.level,
    level: after.level,
    xpIntoLevel: after.xpIntoLevel,
    xpForLevel: after.xpForLevel,
  };
}
