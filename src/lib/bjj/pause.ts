import type { PausePeriod } from "./types";

// Чистые хелперы паузы. Даты — строки yyyy-mm-dd (сравнение строк = хронологическое).

// Эффективный конец периода: фактическое снятие `to`; иначе если дата возврата
// `until` уже прошла — авто-снятие на `until`; иначе сегодня (пауза ещё активна
// и покрывает дни по сегодня включительно).
function effEnd(p: PausePeriod, todayKey: string): string {
  if (p.to) return p.to;
  if (p.until && p.until < todayKey) return p.until;
  return todayKey;
}

// Активная сейчас пауза: без `to` и (без `until` или `until` ещё не прошёл).
export function activePause(
  pauses: PausePeriod[] | undefined,
  todayKey: string,
): PausePeriod | null {
  if (!pauses) return null;
  for (const p of pauses) {
    if (!p.to && (!p.until || p.until >= todayKey)) return p;
  }
  return null;
}

// Попадает ли день k в какой-либо паузный интервал [from, effEnd].
export function isPausedOn(
  k: string,
  pauses: PausePeriod[] | undefined,
  todayKey: string,
): boolean {
  if (!pauses) return false;
  for (const p of pauses) {
    if (k >= p.from && k <= effEnd(p, todayKey)) return true;
  }
  return false;
}

// Пересекает ли календарная неделя (ключи её дней) какую-либо паузу.
export function weekOverlapsPause(
  weekKeys: string[],
  pauses: PausePeriod[] | undefined,
  todayKey: string,
): boolean {
  if (!pauses) return false;
  return weekKeys.some((k) => isPausedOn(k, pauses, todayKey));
}
