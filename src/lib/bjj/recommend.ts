// src/lib/bjj/recommend.ts

import type { Technique, ProgressMap } from "./types";
import { TECH_BY_ID, TECHNIQUES } from "./data";

const MAX_PATH_DEPTH = 3; // Максимум 3 уровня пререквизитов

/**
 * Строит путь обучения к целевой технике.
 * 
 * Ограничения:
 * - Максимум 3 уровня глубины
 * - Только ОБЯЗАТЕЛЬНЫЕ пререквизиты включаются в путь
 * - РЕКОМЕНДУЕМЫЕ показываются отдельно
 */
export function learningPath(target: Technique, progress: ProgressMap): {
  path: Technique[];
  recommended: Technique[];
} {
  const visited = new Set<number>();
  const path: Technique[] = [];
  const recommended: Technique[] = [];
  
  const visit = (id: number, depth: number, isRecommended: boolean = false) => {
    if (visited.has(id)) return;
    if (depth > MAX_PATH_DEPTH) return; // Ограничение глубины
    
    visited.add(id);
    const t = TECH_BY_ID[id];
    if (!t) return;
    
    // Пропускаем уже изученное
    if (progress[id] === "done") return;
    
    // Обходим пререквизиты
    if (t.prerequisites) {
      for (const p of t.prerequisites) {
        const level = t.prerequisiteLevels?.[p] ?? 'required';
        
        if (level === 'required') {
          visit(p, depth + 1, false);
        } else if (level === 'recommended' && !isRecommended) {
          // Рекомендуемые собираем отдельно
          const recTech = TECH_BY_ID[p];
          if (recTech && progress[p] !== 'done' && !visited.has(p)) {
            recommended.push(recTech);
            visited.add(p);
          }
        }
        // 'optional' игнорируем
      }
    }
    
    // Добавляем технику в путь (если не рекомендуемая)
    if (!isRecommended) {
      path.push(t);
    }
  };
  
  visit(target.id, 0);
  
  return {
    path: path.reverse(), // Переворачиваем: от базы к цели
    recommended: recommended.slice(0, 5) // Максимум 5 рекомендуемых
  };
}

/**
 * Возвращает СЛЕДУЮЩИЙ шаг для изучения (самую базовую неизученную технику)
 */
export function nextStep(target: Technique, progress: ProgressMap): Technique | null {
  const { path } = learningPath(target, progress);
  return path.find(t => progress[t.id] !== 'done') ?? null;
}

/**
 * Рекомендации: что изучать дальше
 */
export function recommendations(
  progress: ProgressMap,
  limit: number = 5
): Technique[] {
  const done = new Set(
    Object.entries(progress)
      .filter(([, s]) => s === "done")
      .map(([id]) => Number(id))
  );
  
  return TECHNIQUES.filter(t => {
    if (done.has(t.id)) return false;
    if (!t.prerequisites) return true;
    return t.prerequisites.every(p => done.has(p));
  }).slice(0, limit);
}
