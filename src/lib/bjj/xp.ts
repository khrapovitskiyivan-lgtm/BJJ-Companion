// === XP-ЭКОНОМИКА (выводится, не хранится) ===
// Тотал считается из дневника/прогресса/пояса + локального reviewed. Уровень - из
// порогов cost(L->L+1)=min(50*L,400). Спек docs/superpowers/specs/2026-07-24-xp-economy-design.md.

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
