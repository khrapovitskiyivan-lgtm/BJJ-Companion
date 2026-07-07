// === WORKOUT GENERATOR === (перенос логики из bjj-map/index.html:6130+)
import type { Belt, Group, Technique, Workout, WorkoutConfig } from "./types";
import { BELT_ORDER, COOLDOWN_BY_BELT, MAX_DIFFICULTY_BY_BELT, WARMUP_BY_BELT } from "./constants";
import { TECHNIQUES } from "./data";
import type { StyleProfile } from "./types";

const CRITICAL_TAGS = ["dangerous", "critical", "high_risk"];
const BANNED_IDS = new Set<number>([384]); // Kani Basami — запрещён во всех режимах smart

function beltIndex(b: Belt) {
  return BELT_ORDER.indexOf(b);
}

// === Фильтр по безопасности (из оригинала) ===
function safetyOk(t: Technique, maxBeltIndex: number, mode: WorkoutConfig["safety"]): boolean {
  if (mode === "all") return true;
  if (BANNED_IDS.has(t.id)) return false;
  const isCritical = t.tags.some((x) => CRITICAL_TAGS.includes(x));
  if (mode === "safe") return !isCritical && (t.difficulty || 1) <= 3;
  // smart: белым/синим — без критичных
  if (maxBeltIndex <= 1 && isCritical) return false;
  return true;
}

// === Фильтр библиотеки ===
export function filterTechniques(opts: {
  belt?: Belt;
  gi?: boolean;
  noGi?: boolean;
  group?: Group | "all";
  search?: string;
}): Technique[] {
  const { belt, gi, noGi, group, search } = opts;
  const maxBeltIndex = belt ? beltIndex(belt) : BELT_ORDER.length - 1;
  const needle = search?.trim().toLowerCase();
  return TECHNIQUES.filter((t) => {
    if (belt && beltIndex(t.belt) > maxBeltIndex) return false;
    if (gi === true && !t.gi) return false;
    if (noGi === true && !t.noGi) return false;
    if (group && group !== "all" && t.group !== group) return false;
    if (needle) {
      const hay = `${t.label} ${t.title} ${t.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

// === Генератор ===
export function generateWorkout(
  config: WorkoutConfig,
  profile: StyleProfile,
): Workout {
  const belt = profile.belt;
  const maxBeltIndex = beltIndex(belt);
  const maxDifficulty = MAX_DIFFICULTY_BY_BELT[belt] ?? 2;

  const giMode: "gi" | "nogi" | "both" =
    profile.gi && profile.noGi ? "both" : profile.gi ? "gi" : "nogi";

  let available = TECHNIQUES.filter((n) => {
    if (beltIndex(n.belt) > maxBeltIndex) return false;
    if (config.focus !== "all" && n.group !== config.focus) return false;
    if (giMode === "gi" && !n.gi) return false;
    if (giMode === "nogi" && !n.noGi) return false;
    if (!safetyOk(n, maxBeltIndex, config.safety)) return false;
    if ((n.difficulty || 1) > maxDifficulty) return false;
    return true;
  });

  // Сортировка: предпочтительные теги профиля + сложность
  const preferred: string[] = [];
  if (profile.flexibility) preferred.push("flexibility");
  if (profile.pressure) preferred.push("pressure");
  if (profile.long_limbs) preferred.push("long_limbs");
  if (profile.speed) preferred.push("speed");

  available.sort((a, b) => {
    const aMatch = a.tags.some((t) => preferred.includes(t)) ? 1 : 0;
    const bMatch = b.tags.some((t) => preferred.includes(t)) ? 1 : 0;
    if (config.intensity === "hard") {
      return (b.difficulty || 1) - (a.difficulty || 1) || bMatch - aMatch;
    }
    return bMatch - aMatch || (a.difficulty || 1) - (b.difficulty || 1);
  });

  // Распределение времени (из оригинала)
  let warmupRatio: number, mainRatio: number, cooldownRatio: number, timePerDrillBase: number;
  if (config.intensity === "light") {
    warmupRatio = 0.3; mainRatio = 0.5; cooldownRatio = 0.2; timePerDrillBase = 10;
  } else if (config.intensity === "hard") {
    warmupRatio = 0.15; mainRatio = 0.7; cooldownRatio = 0.15; timePerDrillBase = 5;
  } else {
    warmupRatio = 0.2; mainRatio = 0.65; cooldownRatio = 0.15; timePerDrillBase = 8;
  }
  void mainRatio; // считаем main как остаток

  const warmupMinutes = Math.max(3, Math.round(config.duration * warmupRatio));
  const cooldownMinutes = Math.max(3, Math.round(config.duration * cooldownRatio));
  const mainMinutes = Math.max(0, config.duration - warmupMinutes - cooldownMinutes);
  const techniqueCount = Math.max(2, Math.round(mainMinutes / timePerDrillBase));

  const selected = available.slice(0, Math.min(techniqueCount, available.length));

  if (selected.length === 0) {
    return {
      belt,
      warmup: WARMUP_BY_BELT[belt],
      warmupMinutes,
      drills: [],
      mainMinutes,
      cooldown: COOLDOWN_BY_BELT[belt],
      cooldownMinutes,
      totalMinutes: config.duration,
      message: "Нет техник под текущие фильтры. Попробуйте снять ограничения.",
    };
  }

  // Ключевое правило: timePerDrill = max(2, mainDuration / selected.length)
  const timePerDrill = Math.max(2, Math.round(mainMinutes / selected.length));

  return {
    belt,
    warmup: WARMUP_BY_BELT[belt],
    warmupMinutes,
    drills: selected.map((t) => ({ technique: t, minutes: timePerDrill })),
    mainMinutes,
    cooldown: COOLDOWN_BY_BELT[belt],
    cooldownMinutes,
    totalMinutes: config.duration,
  };
}
