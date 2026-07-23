// === WORKOUT GENERATOR === (перенос логики из bjj-map/index.html:6130+)
import type { Belt, DiaryEntry, Group, Technique, Workout, WorkoutConfig } from "./types";
import { BELT_ORDER, COOLDOWN_BY_BELT, MAX_DIFFICULTY_BY_BELT, WARMUP_BY_BELT } from "./constants";
import { TECHNIQUES } from "./data";
import type { StyleProfile } from "./types";
import type { ProgressMap } from "./store";
import { isUnlocked } from "./recommend";
import { caughtCounts } from "./caught";

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
  belts?: Belt[];
  gi?: boolean;
  noGi?: boolean;
  group?: Group | "all";
  search?: string;
}): Technique[] {
  const { belts, gi, noGi, group, search } = opts;
  // Точный мультивыбор поясов: показываем техники ровно выбранных поясов; пусто = все
  const beltSet = belts && belts.length ? new Set(belts) : null;
  const needle = search?.trim().toLowerCase();
  return TECHNIQUES.filter((t) => {
    if (beltSet && !beltSet.has(t.belt)) return false;
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

// === Доступные техники под конфиг и профиль (общий фильтр для обоих генераторов) ===
function availableFor(config: WorkoutConfig, profile: StyleProfile): Technique[] {
  const maxBeltIndex = beltIndex(profile.belt);
  const maxDifficulty = MAX_DIFFICULTY_BY_BELT[profile.belt] ?? 2;
  const giMode: "gi" | "nogi" | "both" =
    profile.gi && profile.noGi ? "both" : profile.gi ? "gi" : "nogi";

  return TECHNIQUES.filter((n) => {
    if (beltIndex(n.belt) > maxBeltIndex) return false;
    if (config.focus !== "all" && n.group !== config.focus) return false;
    if (giMode === "gi" && !n.gi) return false;
    if (giMode === "nogi" && !n.noGi) return false;
    if (!safetyOk(n, maxBeltIndex, config.safety)) return false;
    if ((n.difficulty || 1) > maxDifficulty) return false;
    return true;
  });
}

// === Распределение времени (из оригинала) ===
function splitTime(config: WorkoutConfig) {
  let warmupRatio: number, cooldownRatio: number, timePerDrillBase: number;
  if (config.intensity === "light") {
    warmupRatio = 0.3; cooldownRatio = 0.2; timePerDrillBase = 10;
  } else if (config.intensity === "hard") {
    warmupRatio = 0.15; cooldownRatio = 0.15; timePerDrillBase = 5;
  } else {
    warmupRatio = 0.2; cooldownRatio = 0.15; timePerDrillBase = 8;
  }
  const warmupMinutes = Math.max(3, Math.round(config.duration * warmupRatio));
  const cooldownMinutes = Math.max(3, Math.round(config.duration * cooldownRatio));
  const mainMinutes = Math.max(0, config.duration - warmupMinutes - cooldownMinutes); // main — остаток
  const techniqueCount = Math.max(2, Math.round(mainMinutes / timePerDrillBase));
  return { warmupMinutes, cooldownMinutes, mainMinutes, techniqueCount };
}

// === Сборка результата из отобранных техник ===
function assemble(
  belt: Belt,
  selected: Technique[],
  times: ReturnType<typeof splitTime>,
  config: WorkoutConfig,
  message?: string,
): Workout {
  const { warmupMinutes, cooldownMinutes, mainMinutes } = times;
  const base = {
    belt,
    warmup: WARMUP_BY_BELT[belt],
    warmupMinutes,
    mainMinutes,
    cooldown: COOLDOWN_BY_BELT[belt],
    cooldownMinutes,
    totalMinutes: config.duration,
  };

  if (selected.length === 0) {
    return {
      ...base,
      drills: [],
      message: "Нет техник под текущие фильтры. Попробуйте снять ограничения.",
    };
  }

  // Ключевое правило: timePerDrill = max(2, mainDuration / selected.length)
  const timePerDrill = Math.max(2, Math.round(mainMinutes / selected.length));
  return {
    ...base,
    drills: selected.map((t) => ({ technique: t, minutes: timePerDrill })),
    message,
  };
}

// === Генератор по профилю ===
export function generateWorkout(
  config: WorkoutConfig,
  profile: StyleProfile,
): Workout {
  const available = availableFor(config, profile);

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

  const times = splitTime(config);
  return assemble(profile.belt, available.slice(0, times.techniqueCount), times, config);
}

// === Генератор по дневнику ===
// Отталкивается от реальных тренировок: что учишь сейчас, что давно не трогал,
// что отработано мало. Дневник пуст → возвращаем обычную генерацию по профилю.
const DAY_MS = 86_400_000;

export function generateWorkoutFromDiary(
  config: WorkoutConfig,
  profile: StyleProfile,
  progress: ProgressMap,
  entries: DiaryEntry[],
): Workout {
  if (entries.length === 0) {
    const w = generateWorkout(config, profile);
    return { ...w, message: "Дневник пуст — план собран по профилю. Отмечайте тренировки, и он станет точнее." };
  }

  // Сколько раз и когда последний раз отрабатывалась каждая техника
  const stats = new Map<number, { count: number; last: string }>();
  for (const e of entries) {
    for (const id of e.techniqueIds) {
      const prev = stats.get(id);
      if (!prev) stats.set(id, { count: 1, last: e.date });
      else stats.set(id, { count: prev.count + 1, last: e.date > prev.last ? e.date : prev.last });
    }
  }

  const today = Date.now();
  const daysSince = (iso: string) => Math.max(0, Math.round((today - new Date(iso).getTime()) / DAY_MS));

  // «Чем поймали»: защиты от сабмишенов соперника получают приоритет
  const caught = caughtCounts(entries);

  const score = (t: Technique): number => {
    const status = progress[t.id] ?? "not_started";
    let s = 0;
    // Что в работе — главный приоритет; затем готовое к изучению; повторение изученного — ниже.
    if (status === "in_progress") s += 100;
    else if (status === "not_started") s += isUnlocked(t, progress) ? 45 : 5;
    else s += 25;

    const st = stats.get(t.id);
    if (!st) s += 30; // ни разу не отрабатывал
    else {
      s += Math.min(daysSince(st.last), 60) * 0.8; // давно не трогал — важнее
      s -= Math.min(st.count, 10) * 3; // отработано много раз — реже
    }

    // Техника защищает от того, чем ловили (сабмишен в её setup_from):
    // один буст по самому частому ловцу, растёт с числом попаданий до х3
    let defenseBoost = 0;
    for (const id of t.setup_from) {
      const c = caught.get(id);
      if (c) defenseBoost = Math.max(defenseBoost, 25 + Math.min(c, 3) * 10);
    }
    return s + defenseBoost;
  };

  const available = availableFor(config, profile);
  const scored = available
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s || (a.t.difficulty || 1) - (b.t.difficulty || 1));

  const times = splitTime(config);
  const selected = scored.slice(0, times.techniqueCount).map((x) => x.t);
  return assemble(profile.belt, selected, times, config);
}
