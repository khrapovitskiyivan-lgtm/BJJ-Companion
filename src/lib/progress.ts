// src/lib/progress.ts
const STORAGE_KEY = 'bjj-companion-progress';

export interface ProgressData {
  learned: number[];      // ID выученных техник
  learning: number[];     // ID в процессе изучения
  lastUpdated: string;    // ISO дата
  version: number;        // Версия схемы данных
}

export const defaultProgress: ProgressData = {
  learned: [],
  learning: [],
  lastUpdated: new Date().toISOString(),
  version: 1,
};

// Чтение прогресса
export function loadProgress(): ProgressData {
  try {
    if (typeof window === 'undefined') return defaultProgress;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress;
    const data = JSON.parse(raw);
    // Проверка что данные валидны
    if (!Array.isArray(data.learned)) return defaultProgress;
    return data;
  } catch (e) {
    console.error('Ошибка загрузки прогресса:', e);
    return defaultProgress;
  }
}

// Сохранение прогресса
export function saveProgress(progress: ProgressData): void {
  try {
    if (typeof window === 'undefined') return;
    progress.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Ошибка сохранения прогресса:', e);
  }
}

// Экспорт в файл (резервная копия)
export function exportProgress(): void {
  const progress = loadProgress();
  const blob = new Blob([JSON.stringify(progress, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bjj-progress-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Импорт из файла
export function importProgress(file: File): Promise<ProgressData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data.learned)) {
          reject(new Error('Неверный формат файла'));
          return;
        }
        saveProgress(data);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
