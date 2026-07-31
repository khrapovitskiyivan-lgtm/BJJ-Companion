// Персональные сигналы карточки техники (чистые функции, тестируемость + SSR-safe).
import { goalScore } from "./recommend";
import { topCatchers } from "./caught";
import type { DiaryEntry, Goal, Style, Technique } from "./types";
import type { ProgressMap } from "./store";

// «Знаешь N из M»: сколько из id освоено
export function knownCount(ids: number[], progress: ProgressMap): { done: number; total: number } {
  return { done: ids.filter((id) => progress[id] === "done").length, total: ids.length };
}

// Лучшее следующее звено из chain_to: непройденное, ранг стиль -> goalScore -> сложность -> id
export function nextStep(input: {
  tech: Technique;
  byId: Map<number, Technique>;
  progress: ProgressMap;
  styleSet: Set<Style>;
  goal?: Goal;
  gi?: boolean;
  noGi?: boolean;
}): Technique | null {
  const { tech, byId, progress, styleSet, goal, gi, noGi } = input;
  const opts = { goal, gi, noGi };
  const cands = tech.chain_to
    .map((id) => byId.get(id))
    .filter((t): t is Technique => !!t && progress[t.id] !== "done");
  if (!cands.length) return null;
  cands.sort(
    (a, b) =>
      (b.styles.some((s) => styleSet.has(s)) ? 1 : 0) - (a.styles.some((s) => styleSet.has(s)) ? 1 : 0) ||
      goalScore(b, opts) - goalScore(a, opts) ||
      a.difficulty - b.difficulty ||
      a.id - b.id,
  );
  return cands[0];
}

// «Зачем тебе это»: сильная причина или null. Приоритет дыра > стиль > цель.
export function cardReason(input: {
  tech: Technique;
  entries: DiaryEntry[];
  styleSet: Set<Style>;
  goal?: Goal;
  gi?: boolean;
  noGi?: boolean;
  byId: Map<number, Technique>;
}): { kind: "gap" | "style" | "goal"; text: string } | null {
  const { tech, entries, styleSet, goal, byId } = input;
  for (const c of topCatchers(entries, 3)) {
    if (tech.setup_from.includes(c.id)) {
      const name = byId.get(c.id)?.nameRu ?? "сабмишена";
      return { kind: "gap", text: `Закрывает твою дыру: ${name}` };
    }
  }
  if (tech.styles.some((s) => styleSet.has(s))) {
    return { kind: "style", text: "Усиливает твою игру" };
  }
  if (goal === "competition" && tech.points_ibjjf > 0) {
    return { kind: "goal", text: "Очковая под соревнования" };
  }
  return null;
}
