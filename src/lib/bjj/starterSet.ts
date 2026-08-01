// Стартовый набор новичка: курированные бакеты базовых техник (data/starter-set.json).
// Прогресс считается по обычным статусам done, без отдельного стейта.
import type { Technique } from "./types";
import type { ProgressMap } from "./store";
import { TECH_BY_ID } from "./data";
import raw from "./generated/starter-set.json";

export interface StarterBucket {
  title: string;
  ids: number[];
}

export const STARTER_SET: StarterBucket[] = raw as StarterBucket[];

export interface StarterBucketProgress {
  title: string;
  total: number;
  done: number;
  techniques: Technique[];
}

export interface StarterProgress {
  done: number;
  total: number;
  buckets: StarterBucketProgress[];
}

// Резолвит id в техники (несуществующие пропускает, cycle-safe), считает изученные.
// set параметризован для тестируемости; в приложении используется STARTER_SET.
export function starterProgress(
  progress: ProgressMap,
  set: StarterBucket[] = STARTER_SET,
): StarterProgress {
  let done = 0;
  let total = 0;
  const buckets: StarterBucketProgress[] = set.map((b) => {
    const techniques = b.ids
      .map((id) => TECH_BY_ID[id])
      .filter((t): t is Technique => !!t);
    const bDone = techniques.filter((t) => progress[t.id] === "done").length;
    done += bDone;
    total += techniques.length;
    return { title: b.title, total: techniques.length, done: bDone, techniques };
  });
  return { done, total, buckets };
}
