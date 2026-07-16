// src/lib/progress.ts

// ВАЖНО: этот ключ ДОЛЖЕН совпадать с PROGRESS_KEY в store.ts
const STORAGE_KEY = "bjj.progress.v1";

export function exportProgress(): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    alert("Нет данных для экспорта");
    return;
  }

  try {
    // Проверяем что это валидный JSON
    JSON.parse(raw);
  } catch {
    alert("Данные в localStorage повреждены");
    return;
  }

  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bjj-progress-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importProgress(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as string;
        // Проверяем что это валидный JSON
        JSON.parse(data);
        localStorage.setItem(STORAGE_KEY, data);
        resolve();
      } catch {
        reject(new Error("Неверный формат файла"));
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsText(file);
  });
}
