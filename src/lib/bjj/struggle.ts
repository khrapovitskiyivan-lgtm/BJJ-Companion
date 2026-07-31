import type { Intensity, StruggleTag } from "./types";

// Диагностика «Что не получилось?»: единый источник тегов, подписей и гейта показа
// для формы дневника и экрана награды. Необязательно, без XP.

export const STRUGGLE_TAGS: StruggleTag[] = ["grip", "base", "timing", "reaction", "unsure"];

export const STRUGGLE_LABEL: Record<StruggleTag, string> = {
  grip: "Захват",
  base: "База/поза",
  timing: "Угол/тайминг",
  reaction: "Реакция партнёра",
  unsure: "Не уверен",
};

// Гейт: вопрос виден только при сигнале сопротивления (был спарринг) —
// поймали, задана интенсивность или есть раунды. Быстрый лог его не получает.
export function showStruggle(draft: {
  caught: number[];
  intensity: Intensity | null;
  rounds: number;
}): boolean {
  return draft.caught.length > 0 || draft.intensity !== null || draft.rounds > 0;
}
