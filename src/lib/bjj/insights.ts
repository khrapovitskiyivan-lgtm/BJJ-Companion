import type { DiaryEntry } from "./types";
import type { ProgressMap } from "./store";

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
