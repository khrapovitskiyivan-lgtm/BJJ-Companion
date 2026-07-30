// === WORKOUT GENERATOR === (перенос логики из bjj-map/index.html:6130+)
import type { Belt, DiaryEntry, Group, Technique, Workout, WorkoutConfig, WorkoutDrill } from "./types";
import { BELT_ORDER, COOLDOWN_BY_BELT, MAX_DIFFICULTY_BY_BELT, WARMUP_BY_BELT } from "./constants";
import { TECHNIQUES } from "./data";
import type { StyleProfile } from "./types";
import type { FavoritesMap, ProgressMap } from "./store";
import { effectiveStyleSet, practiceCountFrom, pickAnchor, buildCluster, clusterMinutes, themeReason } from "./workoutCluster";

const BANNED_IDS = new Set<number>([384]); // Kani Basami — запрещён во всех режимах smart

// Критичность техники: реальный сигнал риска (тег dangerous/critical/high_risk в базе
// не встречается — фикс #2). Опасное = injuryRisk «КРИТИЧНО» или ножные/шейные замки.
export function isCriticalTech(t: Technique): boolean {
  const injury = t.content?.ru?.injuryRisk ?? "";
  if (injury.startsWith("КРИТИЧНО")) return true;
  return t.tags.includes("leg_locks") || t.tags.includes("spinal_lock");
}

function beltIndex(b: Belt) {
  return BELT_ORDER.indexOf(b);
}

// === Фильтр по безопасности (из оригинала) ===
function safetyOk(t: Technique, maxBeltIndex: number, mode: WorkoutConfig["safety"]): boolean {
  if (mode === "all") return true;
  if (BANNED_IDS.has(t.id)) return false;
  const isCritical = isCriticalTech(t);
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
      const hay = `${t.label} ${t.title} ${t.tags.join(" ")} ${(t.aliases ?? []).join(" ")}`.toLowerCase();
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
  drills: WorkoutDrill[],
  times: ReturnType<typeof splitTime>,
  config: WorkoutConfig,
  extra?: { message?: string; theme?: Workout["theme"] },
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

  if (drills.length === 0) {
    return {
      ...base,
      drills: [],
      message: "Нет техник под текущие фильтры. Попробуйте снять ограничения.",
    };
  }

  return { ...base, drills, message: extra?.message, theme: extra?.theme };
}

// === Генераторы отработки: якорный связный кластер ===
// Ротация якоря между генерациями сессии (свежесть темы)
let lastAnchorId: number | undefined;

// Общий сборщик: якорь -> кластер -> время по новизне -> заголовок темы
function clusterWorkout(
  config: WorkoutConfig,
  profile: StyleProfile,
  progress: ProgressMap,
  favorites: FavoritesMap,
  entries: DiaryEntry[],
  source: "profile" | "diary",
): Workout {
  const available = availableFor(config, profile);
  const times = splitTime(config);
  if (available.length === 0) return assemble(profile.belt, [], times, config);

  const practiceCount = practiceCountFrom(entries);
  const styleSet = effectiveStyleSet(profile, progress, practiceCount);
  const opts = { goal: profile.goal, gi: profile.gi, noGi: profile.noGi };

  let anchor = pickAnchor({ available, favorites, progress, entries, styleSet, avoidId: lastAnchorId, source, ...opts });
  if (!anchor) {
    // холодный старт: фундаментальная позиция по поясу; стиль решает ничьи
    const cold = [...available].sort(
      (a, b) =>
        (a.group === "position" || a.group === "fundamentals" ? 0 : 1) -
          (b.group === "position" || b.group === "fundamentals" ? 0 : 1) ||
        (b.styles.some((s) => styleSet.has(s)) ? 1 : 0) - (a.styles.some((s) => styleSet.has(s)) ? 1 : 0) ||
        a.difficulty - b.difficulty ||
        a.id - b.id,
    );
    anchor = cold[0];
  }
  if (!anchor) return assemble(profile.belt, [], times, config);
  lastAnchorId = anchor.id;

  const cluster = buildCluster({ anchor, available, styleSet, count: times.techniqueCount, ...opts });
  const minutes = clusterMinutes(cluster, times.mainMinutes, progress, practiceCount);
  const drills: WorkoutDrill[] = cluster.map((t, i) => ({ technique: t, minutes: minutes[i] ?? 2 }));
  const byId = new Map(TECHNIQUES.map((t) => [t.id, t]));
  const reason = themeReason({ anchor, favorites, progress, entries, byId });
  return assemble(profile.belt, drills, times, config, { theme: { anchorId: anchor.id, reason } });
}

// Генератор по профилю: якорь из избранного/в-процессе (дневник не ведёт выбор)
export function generateWorkout(
  config: WorkoutConfig,
  profile: StyleProfile,
  progress: ProgressMap,
  favorites: FavoritesMap,
  entries: DiaryEntry[],
): Workout {
  return clusterWorkout(config, profile, progress, favorites, entries, "profile");
}

// Генератор по дневнику: якорь приоритетно из свежих записей
export function generateWorkoutFromDiary(
  config: WorkoutConfig,
  profile: StyleProfile,
  progress: ProgressMap,
  entries: DiaryEntry[],
  favorites: FavoritesMap,
): Workout {
  return clusterWorkout(config, profile, progress, favorites, entries, "diary");
}
