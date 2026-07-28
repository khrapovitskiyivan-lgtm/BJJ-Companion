import type { DiaryEntry, Technique, Belt, Goal, Frequency } from "./types";
import type { ProgressMap } from "./store";
import { topCatchers, defensesFor } from "./caught";
import { pendingReview } from "./reviewQueue";
import { todayCardModel } from "./todayCard";
import { nextToLearn } from "./recommend";

// Локальная полночь 'yyyy-mm-dd' в ms
function dayMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
function todayMs(today: Date): number {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

// «Пора повторить»: изученное (done), чего нет в techniqueIds дневника staleDays+ дней.
// Никогда не встречавшееся в дневнике done тоже считается залежавшимся. Пустой дневник -> [].
export function staleToRepeat(
  entries: DiaryEntry[],
  progress: ProgressMap,
  today: Date,
  staleDays = 21,
  cap = 5,
): number[] {
  if (entries.length === 0) return [];
  const lastSeen = new Map<number, number>();
  for (const e of entries) {
    const ms = dayMs(e.date);
    for (const id of e.techniqueIds) if (ms > (lastSeen.get(id) ?? 0)) lastSeen.set(id, ms);
  }
  const cutoff = todayMs(today) - staleDays * 86_400_000;
  const out: { id: number; at: number }[] = [];
  for (const key of Object.keys(progress)) {
    const id = Number(key);
    if (progress[id] !== "done") continue;
    const seen = lastSeen.get(id) ?? 0;
    if (seen <= cutoff) out.push({ id, at: seen });
  }
  out.sort((a, b) => a.at - b.at || a.id - b.id); // самые залежавшиеся первыми
  return out.slice(0, cap).map((x) => x.id);
}

export type InsightKind = "cold-start" | "catcher-defense" | "review-shown" | "repeat-stale" | "plan" | "learn-next";
export interface Insight { kind: InsightKind; weight: number; techniqueIds: number[]; reason: string; route: string }
export interface InsightsInput {
  entries: DiaryEntry[];
  progress: ProgressMap;
  reviewed: Record<number, number>;
  belt: Belt;
  goal?: Goal;
  gi?: boolean;
  noGi?: boolean;
  frequency?: Frequency;
  techniques: Technique[];
  today: Date;
}

const DAY = 86_400_000;
const nameOf = (techs: Technique[], id: number) => techs.find((t) => t.id === id)?.nameRu ?? `#${id}`;

// Композитор «что сделать сегодня»: собирает инсайты из существующих чистых функций,
// ранжирует по весу (калибровка спайка). Живёт на клиенте — сервер дневник не видит.
export function computeInsights(input: InsightsInput): Insight[] {
  const { entries, progress, reviewed, belt, goal, gi, noGi, frequency, techniques, today } = input;
  const nowMs = todayMs(today);
  const out: Insight[] = [];

  // cold-start: нет записей за последние 7 дней -> вернуть к записи (перебивает контент)
  const recent = entries.some((e) => dayMs(e.date) >= nowMs - 6 * DAY);
  if (!recent) {
    out.push({ kind: "cold-start", weight: 200, techniqueIds: [], reason: "Запиши тренировку за 30 секунд", route: "/diary?add" });
  }

  // catcher-defense: 2+ ловли в окне 30 дней, есть невыученная защита
  for (const c of topCatchers(entries, 3, { sinceMs: nowMs - 30 * DAY })) {
    const defs = defensesFor(c.id, techniques, 3).filter((t) => progress[t.id] !== "done");
    if (defs.length) {
      out.push({
        kind: "catcher-defense", weight: 100 + c.count * 10, techniqueIds: defs.map((d) => d.id),
        reason: `Тебя ${c.count} раза поймали на «${nameOf(techniques, c.id)}»`, route: `/technique/${defs[0].id}`,
      });
    }
  }

  // review-shown: показанное на тренировке за 7 дней, не открытое после лога
  const rev = pendingReview(entries, reviewed, progress, today, 7, 6);
  if (rev.length) {
    out.push({ kind: "review-shown", weight: 80, techniqueIds: rev, reason: `Разбери показанное (${rev.length})`, route: `/technique/${rev[0]}` });
  }

  // repeat-stale
  const stale = staleToRepeat(entries, progress, today, 21, 5);
  if (stale.length) {
    out.push({ kind: "repeat-stale", weight: 70, techniqueIds: stale, reason: `Пора повторить: «${nameOf(techniques, stale[0])}»`, route: `/technique/${stale[0]}` });
  }

  // plan: недобор недели
  const tc = todayCardModel(entries, frequency, today);
  if (tc.week && tc.week.done < tc.week.quota && tc.week.daysLeft > 0) {
    out.push({ kind: "plan", weight: 60, techniqueIds: [], reason: `До плана недели ${tc.week.quota - tc.week.done}`, route: "/diary?add" });
  }

  // learn-next: фолбэк (goal-aware)
  const nl = nextToLearn(techniques, progress, belt, 1, { goal, gi, noGi });
  if (nl.length) {
    out.push({ kind: "learn-next", weight: 40, techniqueIds: [nl[0].id], reason: `Следующая цель: «${nl[0].nameRu}»`, route: `/technique/${nl[0].id}` });
  }

  out.sort((a, b) => b.weight - a.weight || (a.techniqueIds[0] ?? 0) - (b.techniqueIds[0] ?? 0));
  return out;
}

export function primaryAction(insights: Insight[]): Insight | null {
  return insights[0] ?? null;
}
