// «Твой стиль»: аффинити пользователя к 10 игровым архетипам.
// Считается из освоенных/в-процессе техник + отработок в дневнике, распределяя
// вес техники по её стилям (styles). Чем больше практикуешь техники стиля — тем он «твой».
import { TECHNIQUES } from "./data";
import { STYLE_ORDER } from "./constants";
import type { Style } from "./types";
import type { ProgressMap } from "./store";

export interface StyleScore {
  style: Style;
  score: number; // относительный вес
  pct: number; // доля от суммарного веса, %
  done: number; // сколько техник этого стиля освоено
}

export function computeStyleAffinity(
  progress: ProgressMap,
  practiceCount: Record<number, number> = {},
): StyleScore[] {
  const acc: Record<string, { score: number; done: number }> = {};
  for (const s of STYLE_ORDER) acc[s] = { score: 0, done: 0 };

  for (const t of TECHNIQUES) {
    if (!t.styles?.length) continue;
    const status = progress[t.id];
    let w = 0;
    if (status === "done") w += 2;
    else if (status === "in_progress") w += 1;
    w += (practiceCount[t.id] ?? 0) * 1.5; // реальные отработки в дневнике весомее
    if (w === 0) continue;

    const per = w / t.styles.length;
    for (const s of t.styles) {
      acc[s].score += per;
      if (status === "done") acc[s].done += 1;
    }
  }

  const total = STYLE_ORDER.reduce((sum, s) => sum + acc[s].score, 0) || 1;
  return STYLE_ORDER.map((style) => ({
    style,
    score: acc[style].score,
    pct: Math.round((acc[style].score / total) * 100),
    done: acc[style].done,
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}
