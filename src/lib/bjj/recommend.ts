// === Рекомендательный движок: «что учить дальше» ===
// Работает на графе пререквизитов + прогрессе пользователя.
import type { Belt, Technique } from "./types";
import type { ProgressMap } from "./store";
import { BELT_ORDER } from "./constants";
import { TECH_BY_ID } from "./data";

const beltIdx = (b: Belt) => BELT_ORDER.indexOf(b);

// Готовность техники: сколько её пререквизитов освоено
export function readiness(t: Technique, progress: ProgressMap): { done: number; total: number; frac: number } {
  const total = t.prerequisites.length;
  if (total === 0) return { done: 0, total: 0, frac: 1 };
  const done = t.prerequisites.filter((p) => progress[p] === "done").length;
  return { done, total, frac: done / total };
}

// Техника «разблокирована»: все пререквизиты освоены
export function isUnlocked(t: Technique, progress: ProgressMap): boolean {
  return t.prerequisites.every((p) => progress[p] === "done");
}

// Текущий фокус: техника в процессе (первая по порядку пояса/сложности)
export function currentFocus(techniques: Technique[], progress: ProgressMap): Technique | null {
  const inProgress = techniques.filter((t) => progress[t.id] === "in_progress");
  if (!inProgress.length) return null;
  inProgress.sort((a, b) => beltIdx(a.belt) - beltIdx(b.belt) || a.difficulty - b.difficulty);
  return inProgress[0];
}

// Следующая цель: не начатая, разблокированная, в пределах пояса пользователя.
// Сортировка: пояс ↑, сложность ↑; разнообразие групп — round-robin.
export function nextToLearn(
  techniques: Technique[],
  progress: ProgressMap,
  userBelt: Belt,
  count = 5,
): Technique[] {
  const myIdx = beltIdx(userBelt);
  const candidates = techniques.filter(
    (t) =>
      (progress[t.id] ?? "not_started") === "not_started" &&
      beltIdx(t.belt) <= myIdx &&
      isUnlocked(t, progress),
  );
  candidates.sort((a, b) => beltIdx(a.belt) - beltIdx(b.belt) || a.difficulty - b.difficulty);
  // round-robin по группам, чтобы не рекомендовать 5 сабмишенов подряд
  const byGroup = new Map<string, Technique[]>();
  for (const t of candidates) {
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group)!.push(t);
  }
  const out: Technique[] = [];
  const queues = [...byGroup.values()];
  let qi = 0;
  while (out.length < count && queues.some((q) => q.length)) {
    const q = queues[qi % queues.length];
    qi++;
    const t = q.shift();
    if (t) out.push(t);
  }
  return out;
}

// Путь обучения к цели: ЛИНЕЙНАЯ цепочка «от фундамента к цели».
// На каждом шаге поднимаемся к ОДНОМУ непройденному пререквизиту — самому
// фундаментальному (ниже пояс, затем ниже сложность). Не собираем всё дерево:
// граф пререквизитов плотный/цикличный, полный обход давал путь на 10-30 техник.
// Циклы отсекаются visited. Длина ограничена MAX_PATH_LEN на всякий случай.
const MAX_PATH_LEN = 6;
export function learningPath(target: Technique, progress: ProgressMap): Technique[] {
  const chain: Technique[] = [];
  const visited = new Set<number>();
  let current: Technique | undefined = target;

  while (current && !visited.has(current.id) && chain.length < MAX_PATH_LEN) {
    visited.add(current.id);
    chain.push(current);
    // непройденные пререквизиты, ещё не попавшие в цепочку
    const prereqs = current.prerequisites
      .map((id) => TECH_BY_ID[id])
      .filter((p): p is Technique => !!p && progress[p.id] !== "done" && !visited.has(p.id));
    if (!prereqs.length) break;
    // самый фундаментальный — ниже пояс, затем ниже сложность
    prereqs.sort((a, b) => beltIdx(a.belt) - beltIdx(b.belt) || a.difficulty - b.difficulty);
    current = prereqs[0];
  }

  return chain.reverse(); // от фундамента к цели: target — последним
}
