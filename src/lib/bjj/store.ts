import { useState, useCallback, useEffect, useMemo } from "react";
import type { Belt, ProgressStatus, StyleProfile, Goal, Frequency } from "./types";

// ============================================================================
// КОНСТАНТЫ — ключи localStorage
// ============================================================================

export const STORAGE_KEYS = {
  PROGRESS: "bjj_progress",
  PROFILE: "bjj_profile",
  ACTIVITY: "bjj_activity_history",
  PRACTICE: "bjj_practice_history",
  THEME: "bjj_theme",
  ONBOARDED: "bjj_onboarded",
} as const;

// ============================================================================
// СОБЫТИЯ — для кросс-компонентной синхронизации
// ============================================================================

export const STORE_EVENTS = {
  PROGRESS_CHANGED: "bjj:progress:changed",
  PROFILE_CHANGED: "bjj:profile:changed",
  ACTIVITY_CHANGED: "bjj:activity:changed",
  PRACTICE_CHANGED: "bjj:practice:changed",
} as const;

// Типы данных событий
export type ProgressMap = Record<number, ProgressStatus>;
export type ActivityHistory = Record<string, number[]>; // dateKey → timestamps
export type PracticeHistory = Record<number, string[]>; // techniqueId → dateKeys

// ============================================================================
// УТИЛИТЫ LOCALSTORAGE
// ============================================================================

function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[store] Failed to write ${key}:`, e);
  }
}

function emitEvent(eventName: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function getDateKey(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

// ============================================================================
// ХУК: useProgress — прогресс техник
// ============================================================================

export function useProgress() {
  const [progress, setProgressState] = useState(() =>
    safeGetItem(STORAGE_KEYS.PROGRESS, {}),
  );

  // ✅ ИСПРАВЛЕНО: Подписка на изменения из других вкладок И внутри текущей вкладки
  useEffect(() => {
    // Обработчик для изменений из других вкладок
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.PROGRESS && e.newValue) {
        try {
          setProgressState(JSON.parse(e.newValue));
        } catch {
          /* ignore */
        }
      }
    };

    // Обработчик для изменений внутри текущей вкладки (кастомное событие)
    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ProgressMap | { id: number; status: ProgressStatus } | undefined;
      if (detail) {
        // Если передан полный объект прогресса
        if ("total" in detail || Object.keys(detail).some(k => !isNaN(Number(k)))) {
          setProgressState(detail as ProgressMap);
        } else {
          // Если передано обновление одной техники
          const update = detail as { id: number; status: ProgressStatus };
          setProgressState(prev => ({ ...prev, [update.id]: update.status }));
        }
      } else {
        setProgressState(safeGetItem(STORAGE_KEYS.PROGRESS, {}));
      }
    };

    window.addEventListener("storage", storageHandler);
    window.addEventListener(STORE_EVENTS.PROGRESS_CHANGED, customHandler);
    
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener(STORE_EVENTS.PROGRESS_CHANGED, customHandler);
    };
  }, []);

  // Записать активность при любом изменении прогресса
  const recordActivity = useCallback(() => {
    const today = getDateKey();
    const history = safeGetItem(STORAGE_KEYS.ACTIVITY, {});
    if (!history[today]) history[today] = [];
    history[today].push(Date.now());
    safeSetItem(STORAGE_KEYS.ACTIVITY, history);
    emitEvent(STORE_EVENTS.ACTIVITY_CHANGED, history);
  }, []);

  // Установить статус техники
  const setStatus = useCallback(
    (id: number, status: ProgressStatus) => {
      setProgressState((prev) => {
        const next = { ...prev, [id]: status };
        safeSetItem(STORAGE_KEYS.PROGRESS, next);
        recordActivity();
        emitEvent(STORE_EVENTS.PROGRESS_CHANGED, { id, status });
        return next;
      });
    },
    [recordActivity],
  );

  // Циклический переключатель статусов: not_started → in_progress → done → not_started
  const cycleStatus = useCallback(
    (id: number) => {
      setProgressState((prev) => {
        const current = prev[id] ?? "not_started";
        const next: ProgressStatus =
          current === "not_started"
            ? "in_progress"
            : current === "in_progress"
            ? "done"
            : "not_started";
        const updated = { ...prev, [id]: next };
        safeSetItem(STORAGE_KEYS.PROGRESS, updated);
        recordActivity();
        emitEvent(STORE_EVENTS.PROGRESS_CHANGED, { id, status: next });
        return updated;
      });
    },
    [recordActivity],
  );

  // Массовое обновление (для импорта)
  const setProgress = useCallback((newProgress: ProgressMap) => {
    setProgressState(newProgress);
    safeSetItem(STORAGE_KEYS.PROGRESS, newProgress);
    recordActivity();
    emitEvent(STORE_EVENTS.PROGRESS_CHANGED, newProgress);
  }, []);

  // Полный сброс
  const clearProgress = useCallback(() => {
    setProgressState({});
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY);
    localStorage.removeItem(STORAGE_KEYS.PRACTICE);
    emitEvent(STORE_EVENTS.PROGRESS_CHANGED, {});
  }, []);

  // Статистика
  const stats = useMemo(() => {
    let done = 0;
    let inProgress = 0;
    let notStarted = 0;
    for (const status of Object.values(progress)) {
      if (status === "done") done++;
      else if (status === "in_progress") inProgress++;
      else notStarted++;
    }
    return { done, inProgress, notStarted, total: done + inProgress + notStarted };
  }, [progress]);

  return {
    progress,
    stats,
    setStatus,
    cycleStatus,
    setProgress,
    clearProgress,
  };
}

// ============================================================================
// ХУК: useProfile — профиль пользователя
// ============================================================================

const DEFAULT_PROFILE: StyleProfile = {
  belt: "white",
  gi: true,
  noGi: true,
};

export function useProfile() {
  const [profile, setProfileState] = useState(() =>
    safeGetItem(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE),
  );

  // ✅ ИСПРАВЛЕНО: Подписка на изменения из других вкладок И внутри текущей вкладки
  useEffect(() => {
    // Обработчик для изменений из других вкладок
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.PROFILE && e.newValue) {
        try {
          setProfileState(JSON.parse(e.newValue));
        } catch {
          /* ignore */
        }
      }
    };

    // Обработчик для изменений внутри текущей вкладки (кастомное событие)
    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as StyleProfile | undefined;
      if (detail) {
        setProfileState(detail);
      } else {
        setProfileState(safeGetItem(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE));
      }
    };

    window.addEventListener("storage", storageHandler);
    window.addEventListener(STORE_EVENTS.PROFILE_CHANGED, customHandler);
    
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener(STORE_EVENTS.PROFILE_CHANGED, customHandler);
    };
  }, []);

  // Полное обновление профиля (после онбординга)
  const setProfile = useCallback((p: Partial<StyleProfile>) => {
    setProfileState((prev) => {
      const next = { ...prev, ...p };
      safeSetItem(STORAGE_KEYS.PROFILE, next);
      emitEvent(STORE_EVENTS.PROFILE_CHANGED, next);
      return next;
    });
  }, []);

  // Обновление отдельных полей
  const updateProfile = useCallback(
    (patch: Partial<StyleProfile>) => {
      setProfile(patch);
    },
    [setProfile],
  );

  // Сброс профиля
  const clearProfile = useCallback(() => {
    setProfileState(DEFAULT_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.ONBOARDED);
    emitEvent(STORE_EVENTS.PROFILE_CHANGED, DEFAULT_PROFILE);
  }, []);

  // Проверка прохождения онбординга
  const isOnboarded = useMemo(() => {
    return Boolean(profile.onboardedAt);
  }, [profile.onboardedAt]);

  // Тема (light/dark)
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const setTheme = useCallback((t: "light" | "dark") => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEYS.THEME, t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return {
    profile: { ...profile, theme },
    isOnboarded,
    setProfile,
    updateProfile,
    clearProfile,
    theme,
    setTheme,
    toggleTheme,
  };
}

// ============================================================================
// ХУК: useActivityHistory — история активности (для streak и heatmap)
// ============================================================================

export function useActivityHistory() {
  const [history, setHistory] = useState(() =>
    safeGetItem(STORAGE_KEYS.ACTIVITY, {}),
  );

  // Подписка на события
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ActivityHistory | undefined;
      if (detail) setHistory(detail);
      else setHistory(safeGetItem(STORAGE_KEYS.ACTIVITY, {}));
    };
    window.addEventListener(STORE_EVENTS.ACTIVITY_CHANGED, handler);
    return () => window.removeEventListener(STORE_EVENTS.ACTIVITY_CHANGED, handler);
  }, []);

  // Streak — дни подряд с активностью
  const streak = useMemo(() => {
    const days = Object.keys(history)
      .filter((k) => history[k].length > 0)
      .sort()
      .reverse();
    if (days.length === 0) return 0;

    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const key = getDateKey(expected);
      if (days.includes(key)) {
        count++;
      } else if (i === 0) {
        // Сегодня ещё не было активности — пропускаем
        continue;
      } else {
        break;
      }
    }
    return count;
  }, [history]);

  // Общее количество действий
  const totalActions = useMemo(() => {
    return Object.values(history).reduce((sum, arr) => sum + arr.length, 0);
  }, [history]);

  // Активные дни
  const activeDays = useMemo(() => {
    return Object.keys(history).filter((k) => history[k].length > 0).length;
  }, [history]);

  // Данные для графика (последние N дней)
  const getChartData = useCallback(
    (daysCount: number = 30) => {
      const data: { date: string; count: number }[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = getDateKey(d);
        data.push({ date: key, count: history[key]?.length ?? 0 });
      }
      return data;
    },
    [history],
  );

  // Данные для тепловой карты (последние N недель)
  const getHeatmapData = useCallback(
    (weeksCount: number = 20) => {
      const weeks: { date: string; count: number }[][] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const totalDays = weeksCount * 7;

      for (let i = totalDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = getDateKey(d);
        const weekIndex = Math.floor(i / 7);
        const dayIndex = 6 - (i % 7);

        if (!weeks[weeksCount - 1 - weekIndex]) weeks[weeksCount - 1 - weekIndex] = [];
        weeks[weeksCount - 1 - weekIndex][dayIndex] = {
          date: key,
          count: history[key]?.length ?? 0,
        };
      }
      return weeks;
    },
    [history],
  );

  return {
    history,
    streak,
    totalActions,
    activeDays,
    getChartData,
    getHeatmapData,
  };
}

// ============================================================================
// ХУК: usePracticeHistory — история практики конкретной техники
// ============================================================================

export function usePracticeHistory(techniqueId?: number) {
  const [history, setHistory] = useState(() =>
    safeGetItem(STORAGE_KEYS.PRACTICE, {}),
  );

  // Подписка на события
  useEffect(() => {
    const handler = () => {
      setHistory(safeGetItem(STORAGE_KEYS.PRACTICE, {}));
    };
    window.addEventListener(STORE_EVENTS.PRACTICE_CHANGED, handler);
    return () => window.removeEventListener(STORE_EVENTS.PRACTICE_CHANGED, handler);
  }, []);

  // История для конкретной техники
  const techniqueHistory = useMemo(() => {
    if (techniqueId === undefined) return [];
    return history[techniqueId] ?? [];
  }, [history, techniqueId]);

  // Количество практик
  const practiceCount = techniqueHistory.length;

  // Последняя практика
  const lastPracticed = useMemo(() => {
    if (techniqueHistory.length === 0) return null;
    return techniqueHistory[techniqueHistory.length - 1];
  }, [techniqueHistory]);

  // Добавить запись о практике
  const recordPractice = useCallback(
    (id: number, dateKey: string = getDateKey()) => {
      setHistory((prev) => {
        const list = prev[id] ?? [];
        // Не дублировать запись в тот же день
        if (list[list.length - 1] === dateKey) return prev;
        const next = { ...prev, [id]: [...list, dateKey] };
        safeSetItem(STORAGE_KEYS.PRACTICE, next);
        emitEvent(STORE_EVENTS.PRACTICE_CHANGED, next);
        return next;
      });
    },
    [],
  );

  // Удалить запись о практике
  const removePractice = useCallback(
    (id: number, dateKey: string) => {
      setHistory((prev) => {
        const list = prev[id] ?? [];
        const next = { ...prev, [id]: list.filter((d) => d !== dateKey) };
        if (next[id].length === 0) delete next[id];
        safeSetItem(STORAGE_KEYS.PRACTICE, next);
        emitEvent(STORE_EVENTS.PRACTICE_CHANGED, next);
        return next;
      });
    },
    [],
  );

  return {
    history,
    techniqueHistory,
    practiceCount,
    lastPracticed,
    recordPractice,
    removePractice,
  };
}

// ============================================================================
// ХУК: useStore — агрегированный доступ ко всему store
// ============================================================================

export function useStore() {
  const progressApi = useProgress();
  const profileApi = useProfile();
  const activityApi = useActivityHistory();

  return {
    ...progressApi,
    ...profileApi,
    activity: activityApi,
  };
}

// ============================================================================
// ЭКСПОРТ / ИМПОРТ — полное резервное копирование
// ============================================================================

export interface BackupData {
  version: number;
  exportedAt: string;
  progress: ProgressMap;
  profile: StyleProfile;
  activity: ActivityHistory;
  practice: PracticeHistory;
}

export function createBackup(): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: safeGetItem(STORAGE_KEYS.PROGRESS, {}),
    profile: safeGetItem(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE),
    activity: safeGetItem(STORAGE_KEYS.ACTIVITY, {}),
    practice: safeGetItem(STORAGE_KEYS.PRACTICE, {}),
  };
}

export function restoreBackup(data: BackupData): boolean {
  try {
    if (!data || typeof data !== "object" || data.version !== 1) {
      return false;
    }
    if (data.progress) safeSetItem(STORAGE_KEYS.PROGRESS, data.progress);
    if (data.profile) safeSetItem(STORAGE_KEYS.PROFILE, data.profile);
    if (data.activity) safeSetItem(STORAGE_KEYS.ACTIVITY, data.activity);
    if (data.practice) safeSetItem(STORAGE_KEYS.PRACTICE, data.practice);

    // Уведомляем все компоненты
    emitEvent(STORE_EVENTS.PROGRESS_CHANGED, data.progress);
    emitEvent(STORE_EVENTS.PROFILE_CHANGED, data.profile);
    emitEvent(STORE_EVENTS.ACTIVITY_CHANGED, data.activity);
    emitEvent(STORE_EVENTS.PRACTICE_CHANGED, data.practice);

    return true;
  } catch {
    return false;
  }
}

export function downloadBackup(): void {
  const data = createBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bjj-backup-${getDateKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  emitEvent(STORE_EVENTS.PROGRESS_CHANGED, {});
  emitEvent(STORE_EVENTS.PROFILE_CHANGED, DEFAULT_PROFILE);
  emitEvent(STORE_EVENTS.ACTIVITY_CHANGED, {});
  emitEvent(STORE_EVENTS.PRACTICE_CHANGED, {});
}

// ============================================================================
// SUPABASE STUBS — для будущей синхронизации с облаком
// ============================================================================

/**
 * Заглушки для интеграции с Supabase.
 * Когда будете готовы — замените на реальные вызовы:
 *
 * import { createClient } from '@supabase/supabase-js'
 * const supabase = createClient(URL, ANON_KEY)
 */

export async function syncToCloud(_userId: string): Promise<boolean> {
  // TODO: await supabase.from('profiles').upsert({ id: userId, ...createBackup() })
  console.warn("[store] syncToCloud not implemented yet");
  return false;
}

export async function syncFromCloud(_userId: string): Promise<boolean> {
  // TODO: const { data } = await supabase.from('profiles').select().eq('id', userId).single()
  // TODO: if (data) restoreBackup(data.backup)
  console.warn("[store] syncFromCloud not implemented yet");
  return false;
}
