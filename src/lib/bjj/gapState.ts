// Состояние карточки «Разрыв»: чистая функция (тестируемость + rules-of-hooks в GapCard).
// hidden — холодный старт / до mount / дисмисснут; prompt — пора выбрать аспирацию;
// ontrack/gap — аспирация задана и совпадает/не совпадает с реальным топ-архетипом.
import { ARCHETYPE_MIN_DONE } from "./stats";
import type { StyleScore } from "./styleProfile";
import type { Style } from "./types";

export type GapState = "hidden" | "prompt" | "ontrack" | "gap";

export function gapState(input: {
  scores: StyleScore[];
  preferredStyles?: Style[];
  doneCount: number;
  mounted: boolean;
  dismissed: boolean;
}): GapState {
  const { scores, preferredStyles, doneCount, mounted, dismissed } = input;
  if (doneCount < ARCHETYPE_MIN_DONE || scores.length === 0) return "hidden";
  if (!preferredStyles?.length) return mounted && !dismissed ? "prompt" : "hidden";
  return preferredStyles.includes(scores[0].style) ? "ontrack" : "gap";
}
