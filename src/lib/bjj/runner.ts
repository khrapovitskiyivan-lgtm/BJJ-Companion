import type { Workout } from "./types";

// Логика раннера тренировки: секундный тик по разделам (разминка/основа/заминка).
// Чистые функции без React и звука — сигналы возвращаются наружу, тестируются vitest.

export interface RunSection {
  key: string;
  title: string;
  seconds: number;
}

export interface RunPhase {
  sectionIdx: number;
  left: number; // секунд до конца текущего раздела
  finished: boolean;
}

// Сигналы тика: warn — короткий гудок (последние 5 сек раздела),
// section — громкий конец раздела, finish — громкий финал тренировки.
export type RunSignal = "warn" | "section" | "finish" | null;

export function buildSections(w: Workout): RunSection[] {
  const out: RunSection[] = [];
  if (w.warmupMinutes > 0) out.push({ key: "warmup", title: "Разминка", seconds: w.warmupMinutes * 60 });
  if (w.mainMinutes > 0 && w.drills.length > 0)
    out.push({ key: "main", title: "Основная часть", seconds: w.mainMinutes * 60 });
  if (w.cooldownMinutes > 0) out.push({ key: "cooldown", title: "Заминка", seconds: w.cooldownMinutes * 60 });
  return out;
}

export function initialPhase(sections: RunSection[]): RunPhase {
  return { sectionIdx: 0, left: sections[0]?.seconds ?? 0, finished: sections.length === 0 };
}

export function tick(sections: RunSection[], p: RunPhase): { next: RunPhase; signal: RunSignal } {
  if (p.finished) return { next: p, signal: null };
  const left = p.left - 1;
  if (left > 0) return { next: { ...p, left }, signal: left <= 5 ? "warn" : null };
  // left == 0 — раздел закончился
  if (p.sectionIdx >= sections.length - 1) {
    return { next: { sectionIdx: p.sectionIdx, left: 0, finished: true }, signal: "finish" };
  }
  const nextIdx = p.sectionIdx + 1;
  return { next: { sectionIdx: nextIdx, left: sections[nextIdx].seconds, finished: false }, signal: "section" };
}

// Догон по настенным часам: телефон спал N секунд — прокручиваем тики разом.
// Сигналы копятся списком; кто их играть и какие — решает вызывающий.
export function advanceBy(
  sections: RunSection[],
  p: RunPhase,
  elapsedSec: number,
): { next: RunPhase; signals: RunSignal[] } {
  let cur = p;
  const signals: RunSignal[] = [];
  for (let i = 0; i < elapsedSec && !cur.finished; i++) {
    const r = tick(sections, cur);
    cur = r.next;
    if (r.signal) signals.push(r.signal);
  }
  return { next: cur, signals };
}

// Индекс текущей техники основной части по прошедшему времени раздела
export function currentDrillIndex(drillMinutes: number[], sectionSeconds: number, left: number): number {
  const elapsed = sectionSeconds - left;
  let acc = 0;
  for (let i = 0; i < drillMinutes.length; i++) {
    acc += drillMinutes[i] * 60;
    if (elapsed < acc) return i;
  }
  return Math.max(0, drillMinutes.length - 1);
}
