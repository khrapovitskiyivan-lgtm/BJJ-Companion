import type { DiaryEntry } from "./types";
import type { ProgressMap } from "./store";

// Очередь «Разбери показанное»: техники из недавних записей дневника, которые
// пользователь ещё не открывал после лога и не отметил изученными. Чистая
// функция — «сегодня» параметром (тестируемость, SSR-безопасность).
// «Разобрал» = открыл карточку (reviewed[id] = момент открытия в ms).

// Локальная полночь дня записи ('YYYY-MM-DD') в ms
function dayStartMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function pendingReview(
  entries: DiaryEntry[],
  reviewed: Record<number, number>,
  progress: ProgressMap,
  today: Date,
  windowDays = 7,
  cap = 6,
): number[] {
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startMs = todayMs - (windowDays - 1) * 86_400_000;

  // techId -> самая свежая полночь лога в окне (по techniqueIds, НЕ caughtBy)
  const shownAt = new Map<number, number>();
  for (const e of entries) {
    const ms = dayStartMs(e.date);
    if (ms < startMs || ms > todayMs) continue;
    for (const id of e.techniqueIds) {
      if (ms > (shownAt.get(id) ?? 0)) shownAt.set(id, ms);
    }
  }

  const out: { id: number; at: number }[] = [];
  for (const [id, at] of shownAt) {
    if (progress[id] === "done") continue; // освоенное не разбираем
    if ((reviewed[id] ?? 0) < at) out.push({ id, at }); // не открывали после лога
  }
  out.sort((a, b) => b.at - a.at || a.id - b.id); // свежие сверху, id для детерминизма
  return out.slice(0, cap).map((x) => x.id);
}
