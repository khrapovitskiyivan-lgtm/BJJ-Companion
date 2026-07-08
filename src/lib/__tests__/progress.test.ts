import { describe, it, expect, beforeEach } from 'vitest';
import { loadProgress, saveProgress, defaultProgress } from '../progress';

describe('Progress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('возвращает дефолтный прогресс если ничего не сохранено', () => {
    const progress = loadProgress();
    expect(progress).toEqual(defaultProgress);
  });

  it('сохраняет и загружает прогресс', () => {
    const testProgress = {
      ...defaultProgress,
      learned: [1, 2, 3],
    };
    saveProgress(testProgress);
    const loaded = loadProgress();
    expect(loaded.learned).toEqual([1, 2, 3]);
  });

  it('возвращает дефолт при битых данных', () => {
    localStorage.setItem('bjj-companion-progress', 'not-json');
    const progress = loadProgress();
    expect(progress).toEqual(defaultProgress);
  });
});
