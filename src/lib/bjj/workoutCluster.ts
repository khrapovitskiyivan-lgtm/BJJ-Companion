// === Якорный позиционный кластер: подбор связной отработки из графа ===
// Иерархия сигналов: прогресс/дневник (гейт) -> избранное (якорь) -> стиль (вес)
// -> goal (нудж). Инвариант: избранный якорь не выкидывается goal/стилем.
import { computeStyleAffinity } from "./styleProfile";
import { goalScore } from "./recommend";
import { topCatchers } from "./caught";
import type { DiaryEntry, Goal, Style, StyleProfile, Technique } from "./types";
import type { FavoritesMap, ProgressMap } from "./store";

const RECENT_DAYS = 21;
const DAY_MS = 86_400_000;
const CLUSTER_CAP = 8;

// Повторы техник в дневнике (как practiceCount в сторе/статах)
export function practiceCountFrom(entries: DiaryEntry[]): Record<number, number> {
  const m: Record<number, number> = {};
  for (const e of entries) for (const id of e.techniqueIds) m[id] = (m[id] ?? 0) + 1;
  return m;
}

// Effective style: заданный игроком (preferredStyles) приоритетнее выведенного из
// активности (топ computeStyleAffinity). Даёт стиль-вес у всех без нового экрана онбординга.
export function effectiveStyleSet(
  profile: StyleProfile,
  progress: ProgressMap,
  practiceCount: Record<number, number>,
): Set<Style> {
  if (profile.preferredStyles?.length) return new Set(profile.preferredStyles);
  const top = computeStyleAffinity(progress, practiceCount)[0]?.style;
  return top ? new Set<Style>([top]) : new Set<Style>();
}

// Техники из записей дневника за последние `days` дней
export function recentDiaryIds(entries: DiaryEntry[], days: number, today: Date = new Date()): Set<number> {
  const cutoff = today.getTime() - days * DAY_MS;
  const out = new Set<number>();
  for (const e of entries) {
    const [y, m, d] = e.date.split("-").map(Number);
    if (new Date(y, m - 1, d).getTime() >= cutoff) for (const id of e.techniqueIds) out.add(id);
  }
  return out;
}

// Выбор якоря. Пул: profile -> избранное ∪ in_progress; diary -> плюс свежий дневник (приоритетно).
// Ранг тиров кодирует иерархию; стиль и goal — мягкие тай-брейки поверх (не удаляют кандидатов).
export function pickAnchor(input: {
  available: Technique[];
  favorites: FavoritesMap;
  progress: ProgressMap;
  entries: DiaryEntry[];
  styleSet: Set<Style>;
  goal?: Goal;
  gi?: boolean;
  noGi?: boolean;
  avoidId?: number;
  source: "profile" | "diary";
  today?: Date;
}): Technique | null {
  const { available, favorites, progress, entries, styleSet, goal, gi, noGi, avoidId, source } = input;
  const recent = source === "diary" ? recentDiaryIds(entries, RECENT_DAYS, input.today) : new Set<number>();
  const pool = available.filter(
    (t) => t.id !== avoidId && (favorites[t.id] || progress[t.id] === "in_progress" || recent.has(t.id)),
  );
  if (!pool.length) return null;
  const tier = (t: Technique): number => {
    // diary: свежее из дневника приоритетно; избранное свежее — самый верх
    if (recent.has(t.id)) return favorites[t.id] ? 4 : 3;
    if (favorites[t.id]) return 2;
    if (progress[t.id] === "in_progress") return 1;
    return 0;
  };
  const styleW = (t: Technique) => (t.styles.some((s) => styleSet.has(s)) ? 1 : 0);
  const opts = { goal, gi, noGi };
  const sorted = [...pool].sort(
    (a, b) =>
      tier(b) - tier(a) ||
      styleW(b) - styleW(a) ||
      goalScore(b, opts) - goalScore(a, opts) ||
      a.difficulty - b.difficulty ||
      a.id - b.id,
  );
  return sorted[0];
}

// Позиции/проходы/переходы — лучший «вход» (встать в позицию)
function posRank(t: Technique): number {
  return t.group === "position" ? 0 : t.group === "guard_pass" ? 1 : t.group === "transition" ? 2 : 3;
}

// Кластер вокруг якоря: вход -> якорь -> 1-2 продолжения -> родня той же позиции.
// Всё из available (пост-фильтр пояс/безопасность), visited-guard + кап (граф цикличен).
export function buildCluster(input: {
  anchor: Technique;
  available: Technique[];
  styleSet: Set<Style>;
  goal?: Goal;
  gi?: boolean;
  noGi?: boolean;
  count: number;
}): Technique[] {
  const { anchor, available, styleSet, goal, gi, noGi, count } = input;
  const byId = new Map(available.map((t) => [t.id, t]));
  const opts = { goal, gi, noGi };
  const rank = (a: Technique, b: Technique) =>
    (b.styles.some((s) => styleSet.has(s)) ? 1 : 0) - (a.styles.some((s) => styleSet.has(s)) ? 1 : 0) ||
    goalScore(b, opts) - goalScore(a, opts) ||
    a.difficulty - b.difficulty ||
    a.id - b.id;

  const cap = Math.min(count, CLUSTER_CAP);
  const chosen: Technique[] = [];
  const visited = new Set<number>();
  const push = (t?: Technique): void => {
    if (t && !visited.has(t.id) && chosen.length < cap) {
      visited.add(t.id);
      chosen.push(t);
    }
  };

  // вход: 1 из setup_from, доступный, предпочтительно позиция
  const entry = anchor.setup_from
    .map((id) => byId.get(id))
    .filter((t): t is Technique => !!t)
    .sort((a, b) => posRank(a) - posRank(b) || rank(a, b))[0];
  push(entry);
  push(anchor);

  // продолжения: до 2 из chain_to
  const followups = anchor.chain_to
    .map((id) => byId.get(id))
    .filter((t): t is Technique => !!t && !visited.has(t.id))
    .sort(rank);
  push(followups[0]);
  push(followups[1]);

  // родня: та же группа + общий вход (setup_from) с якорем
  const anchorEntries = new Set(anchor.setup_from);
  const kin = available
    .filter((t) => !visited.has(t.id) && t.group === anchor.group && t.setup_from.some((id) => anchorEntries.has(id)))
    .sort(rank);
  for (const t of kin) {
    if (chosen.length >= cap) break;
    push(t);
  }

  // добор до count по available (никогда «поток из 1»)
  if (chosen.length < cap) {
    const rest = available.filter((t) => !visited.has(t.id)).sort(rank);
    for (const t of rest) {
      if (chosen.length >= cap) break;
      push(t);
    }
  }
  return chosen;
}

// Вес новизны: не начатое важнее, часто отработанное — меньше
function noveltyWeight(t: Technique, progress: ProgressMap, practiceCount: Record<number, number>): number {
  const status = progress[t.id] ?? "not_started";
  let w = status === "not_started" ? 3 : status === "in_progress" ? 2 : 1;
  w -= Math.min(practiceCount[t.id] ?? 0, 4) * 0.25;
  return Math.max(0.5, w);
}

// Распределение mainMinutes по новизне: целые минуты, минимум 2, сумма = mainMinutes.
export function clusterMinutes(
  cluster: Technique[],
  mainMinutes: number,
  progress: ProgressMap,
  practiceCount: Record<number, number>,
): number[] {
  const n = cluster.length;
  if (n === 0) return [];
  const weights = cluster.map((t) => noveltyWeight(t, progress, practiceCount));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const mins = weights.map((w) => Math.max(2, Math.round((w / sum) * mainMinutes)));
  let diff = mainMinutes - mins.reduce((a, b) => a + b, 0);
  const order = mins.map((_, i) => i).sort((a, b) => mins[b] - mins[a]);
  let guard = 0;
  while (diff !== 0 && guard < 1000) {
    const i = order[guard % order.length];
    if (diff > 0) {
      mins[i]++;
      diff--;
    } else if (mins[i] > 2) {
      mins[i]--;
      diff++;
    }
    guard++;
  }
  return mins;
}

// Строка «почему эта тема» для заголовка
export function themeReason(input: {
  anchor: Technique;
  favorites: FavoritesMap;
  progress: ProgressMap;
  entries: DiaryEntry[];
  byId: Map<number, Technique>;
  today?: Date;
}): string {
  const { anchor, favorites, progress, entries, byId } = input;
  if (favorites[anchor.id]) return "Твой избранный приём";
  if (progress[anchor.id] === "in_progress") return "Ты это учишь";
  if (recentDiaryIds(entries, RECENT_DAYS, input.today).has(anchor.id)) return "Свежее с тренировки";
  for (const c of topCatchers(entries, 3)) {
    if (anchor.setup_from.includes(c.id)) {
      const name = byId.get(c.id)?.nameRu ?? "сабмишена";
      return `Закрывает твою дыру: ${name}`;
    }
  }
  return "Основа под твой пояс";
}
