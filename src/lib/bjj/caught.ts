import type { DiaryEntry, Technique } from "./types";

// «Что тебя ловит»: статистика пропущенных сабмишенов из дневника («Чем поймали»)
// и защиты от них. Защиты берутся из графа без новых данных: техника защищает от
// сабмишена, если он есть в её setup_from (побеги ссылаются на сабмишены именно так).

// Сколько раз ловили каждым сабмишеном
export function caughtCounts(entries: DiaryEntry[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const e of entries) {
    for (const id of e.caughtBy ?? []) map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

// Чем ловят: 2+ раз — закономерность, один раз — случайность
export function topCatchers(entries: DiaryEntry[], limit = 3): { id: number; count: number }[] {
  return [...caughtCounts(entries)]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));
}

// Защиты от сабмишена: побеги первыми (прямой ответ), затем переходы и остальное
export function defensesFor(catcherId: number, techniques: Technique[], limit = 4): Technique[] {
  const rank = (t: Technique) => (t.group === "escape" ? 0 : t.group === "transition" ? 1 : 2);
  return techniques
    .filter((t) => t.setup_from.includes(catcherId))
    .sort((a, b) => rank(a) - rank(b) || a.difficulty - b.difficulty)
    .slice(0, limit);
}
