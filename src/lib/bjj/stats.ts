// === 6 СТАТОВ ИЗ ТЕГОВ + ПРОФИЛИ АРХЕТИПОВ ===
// Вторая ось геймификации, независимая от архетипов: архетип считается из styles
// (что играешь), статы из tags (как механически работает). Разные источники,
// поэтому модель не схлопывается в дубль. Профили архетипов (primary/secondary стат)
// выводятся из данных через lift, а не пишутся руками: не разойдутся с CSV.
import { TECHNIQUES } from "./data";
import { STYLE_ORDER } from "./constants";
import type { ProgressMap } from "./store";
import type { Style, Technique } from "./types";

export type StatKey = "control" | "pressure" | "structure" | "leverage" | "flexibility" | "speed";

export const STAT_ORDER: StatKey[] = ["control", "pressure", "structure", "leverage", "flexibility", "speed"];

export const STAT_META: Record<StatKey, { ru: string; tags: string[] }> = {
  control: { ru: "Контроль", tags: ["angle_control", "control"] },
  pressure: { ru: "Давление", tags: ["pressure", "weight_distribution"] },
  structure: { ru: "Структура", tags: ["frames", "base_break"] },
  leverage: { ru: "Рычаг", tags: ["limb_isolation", "joint_lock", "leverage"] },
  flexibility: { ru: "Гибкость", tags: ["flexibility"] },
  speed: { ru: "Скорость", tags: ["speed"] },
};

// До этого числа освоенных техник архетип и «Разрыв» не показываем (холодный старт)
export const ARCHETYPE_MIN_DONE = 5;

export interface StatScore {
  stat: StatKey;
  pct: number;      // 0..100 целые — для интерфейса
  pctExact: number; // без округления — для дельт (экран награды)
  done: number; // освоено техник этого стата
  total: number; // всего техник этого стата в базе
}

export function hasStat(t: Technique, stat: StatKey): boolean {
  return t.tags.some((g) => STAT_META[stat].tags.includes(g));
}

export function countDone(progress: ProgressMap): number {
  return Object.values(progress).filter((s) => s === "done").length;
}

// Прокачка статов: вес техники как в computeStyleAffinity (done=2, in_progress=1,
// отработка в дневнике +1.5). Проценты от максимума по стату (2*total), не сырьё:
// иначе редкие статы (speed: 34 техники) никогда не догонят частые (control: 140).
export function computeStatsFor(
  techniques: Technique[],
  progress: ProgressMap,
  practiceCount: Record<number, number> = {},
): StatScore[] {
  return STAT_ORDER.map((stat) => {
    let raw = 0, done = 0, total = 0;
    for (const t of techniques) {
      if (!hasStat(t, stat)) continue;
      total++;
      const status = progress[t.id];
      let w = 0;
      if (status === "done") { w += 2; done++; }
      else if (status === "in_progress") w += 1;
      w += (practiceCount[t.id] ?? 0) * 1.5;
      raw += w;
    }
    const max = total * 2;
    const pctExact = max > 0 ? Math.min(100, (raw / max) * 100) : 0;
    return { stat, pct: Math.round(pctExact), pctExact, done, total };
  });
}

export function computeStats(progress: ProgressMap, practiceCount: Record<number, number> = {}): StatScore[] {
  return computeStatsFor(TECHNIQUES, progress, practiceCount);
}

// Профили архетипов через lift: доля стата внутри архетипа / доля стата по базе.
// primary: максимальный lift, secondary: следующий.
export function deriveArchetypeStats(
  techniques: Technique[],
): Record<Style, { primary: StatKey; secondary: StatKey }> {
  const base: Record<StatKey, number> = {} as Record<StatKey, number>;
  for (const s of STAT_ORDER) {
    base[s] = techniques.filter((t) => hasStat(t, s)).length / (techniques.length || 1);
  }
  const out = {} as Record<Style, { primary: StatKey; secondary: StatKey }>;
  for (const style of STYLE_ORDER) {
    const pool = techniques.filter((t) => t.styles.includes(style));
    const ranked = STAT_ORDER.map((s) => {
      const share = pool.length ? pool.filter((t) => hasStat(t, s)).length / pool.length : 0;
      return { s, lift: base[s] > 0 ? share / base[s] : 0 };
    }).sort((a, b) => b.lift - a.lift);
    out[style] = { primary: ranked[0].s, secondary: ranked[1].s };
  }
  return out;
}

// Профили на реальных данных (вычисляются один раз при загрузке модуля)
export const ARCHETYPE_STATS = deriveArchetypeStats(TECHNIQUES);
