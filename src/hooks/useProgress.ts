// src/hooks/useProgress.ts
import { useState, useEffect, useCallback } from 'react';
import { loadProgress, saveProgress, type ProgressData } from '~/lib/progress';

export function useProgress() {
  const [progress, setProgress] = useState<ProgressData>(() => loadProgress());

  // Сохраняем при каждом изменении
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const markLearned = useCallback((techniqueId: number) => {
    setProgress((prev) => {
      if (prev.learned.includes(techniqueId)) return prev;
      return {
        ...prev,
        learned: [...prev.learned, techniqueId],
        learning: prev.learning.filter((id) => id !== techniqueId),
      };
    });
  }, []);

  const markLearning = useCallback((techniqueId: number) => {
    setProgress((prev) => {
      if (prev.learning.includes(techniqueId) || prev.learned.includes(techniqueId)) {
        return prev;
      }
      return {
        ...prev,
        learning: [...prev.learning, techniqueId],
      };
    });
  }, []);

  const unmark = useCallback((techniqueId: number) => {
    setProgress((prev) => ({
      ...prev,
      learned: prev.learned.filter((id) => id !== techniqueId),
      learning: prev.learning.filter((id) => id !== techniqueId),
    }));
  }, []);

  const isLearned = useCallback(
    (techniqueId: number) => progress.learned.includes(techniqueId),
    [progress.learned]
  );

  const isLearning = useCallback(
    (techniqueId: number) => progress.learning.includes(techniqueId),
    [progress.learning]
  );

  return {
    progress,
    markLearned,
    markLearning,
    unmark,
    isLearned,
    isLearning,
    totalLearned: progress.learned.length,
    totalLearning: progress.learning.length,
  };
}
