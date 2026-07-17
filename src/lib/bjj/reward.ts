import { dayStreak, planStreak, trainedByDate, weekDays, weekStatus } from "./plan";
import { topCatchers } from "./caught";
import { computeStatsFor, hasStat, type StatKey } from "./stats";
import type { ProgressMap } from "./store";
import type { DiaryEntry, Frequency, Technique } from "./types";

// Экран награды после сохранения записи дневника: 2-3 дельты «до/после записи»,
// посчитанные теми же формулами, что и остальное приложение (plan/stats/caught).
// Чистый модуль: «сегодня» и техники параметрами (тестируемость, SSR-безопасность).

export interface PlanSlot {
  kind: "plan";
  done: number;       // тренировочных дней в неделе даты записи (после записи)
  quota: number;
  hitNow: boolean;    // квота добита именно этой записью
  over: boolean;      // новый тренировочный день сверх квоты
  weekStreak: number; // недель в плане подряд (после записи)
}

export interface DaysSlot {
  kind: "days";
  streak: number; // дней подряд (частота не задана)
}

export interface StatSlot {
  stat: StatKey;
  pctBefore: number; // дробные проценты (pctExact)
  pctAfter: number;
  count: number;     // техник записи с этим статом
}

export interface DefenseSlot {
  defense: Technique; // отработанная защита из записи
  catcher: Technique; // сабмишен, от которого она защищает
  timesCaught: number;
}

export interface EntryReward {
  week: PlanSlot | DaysSlot;
  stat?: StatSlot;
  defense?: DefenseSlot;
}

export function computeEntryReward(input: {
  entriesBefore: DiaryEntry[];
  entry: Omit<DiaryEntry, "id">;
  progressBefore: ProgressMap;
  techniques: Technique[];
  frequency?: Frequency;
  today: Date;
}): EntryReward {
  const { entriesBefore, entry, progressBefore, techniques, frequency, today } = input;
  const entriesAfter: DiaryEntry[] = [{ ...entry, id: "new" }, ...entriesBefore];
  const trainedBefore = trainedByDate(entriesBefore);
  const trainedAfter = trainedByDate(entriesAfter);
  const byId = new Map(techniques.map((t) => [t.id, t]));

  // Слот недели: с частотой — квота недели даты записи, без частоты — дневной стрик
  let week: PlanSlot | DaysSlot;
  if (frequency) {
    const [y, m, d] = entry.date.split("-").map(Number);
    const wk = weekDays(new Date(y, m - 1, d));
    const before = weekStatus(wk, trainedBefore, frequency, today);
    const after = weekStatus(wk, trainedAfter, frequency, today);
    week = {
      kind: "plan",
      done: after.done,
      quota: frequency,
      hitNow: before.done < frequency && after.done >= frequency,
      over: before.done >= frequency && after.done > before.done,
      weekStreak: planStreak(trainedAfter, frequency, today),
    };
  } else {
    week = { kind: "days", streak: dayStreak(trainedAfter, today) };
  }

  // Рост стата: «после» повторяет save() — отработка +1.5, not_started -> in_progress
  const progressAfter: ProgressMap = { ...progressBefore };
  for (const id of entry.techniqueIds) {
    if ((progressAfter[id] ?? "not_started") === "not_started") progressAfter[id] = "in_progress";
  }
  const countPractice = (list: DiaryEntry[]) => {
    // как practiceCount в store.ts
    const m: Record<number, number> = {};
    for (const e of list) for (const id of e.techniqueIds) m[id] = (m[id] ?? 0) + 1;
    return m;
  };
  const statsBefore = computeStatsFor(techniques, progressBefore, countPractice(entriesBefore));
  const statsAfter = computeStatsFor(techniques, progressAfter, countPractice(entriesAfter));
  let stat: StatSlot | undefined;
  for (let i = 0; i < statsAfter.length; i++) {
    const delta = statsAfter[i].pctExact - statsBefore[i].pctExact;
    const best = stat ? stat.pctAfter - stat.pctBefore : 0;
    if (delta > best) {
      stat = {
        stat: statsAfter[i].stat,
        pctBefore: statsBefore[i].pctExact,
        pctAfter: statsAfter[i].pctExact,
        count: 0,
      };
    }
  }
  if (stat) {
    const key = stat.stat;
    stat.count = entry.techniqueIds.filter((id) => {
      const t = byId.get(id);
      return t ? hasStat(t, key) : false;
    }).length;
  }

  // Защита: в записи отработан ответ на то, чем реально ловят (2+ поимок).
  // topCatchers отсортирован по частоте — первое совпадение и есть главная дыра.
  let defense: DefenseSlot | undefined;
  const rank = (t: Technique) => (t.group === "escape" ? 0 : t.group === "transition" ? 1 : 2);
  for (const { id: catcherId, count } of topCatchers(entriesAfter, 99)) {
    const defs = entry.techniqueIds
      .map((tid) => byId.get(tid))
      .filter((t): t is Technique => !!t && t.setup_from.includes(catcherId))
      .sort((a, b) => rank(a) - rank(b) || a.difficulty - b.difficulty);
    const catcher = byId.get(catcherId);
    if (defs.length > 0 && catcher) {
      defense = { defense: defs[0], catcher, timesCaught: count };
      break;
    }
  }

  return { week, stat, defense };
}
