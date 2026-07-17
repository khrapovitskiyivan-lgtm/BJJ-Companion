// === STORE (localStorage + optional Cloud sync с 3s timeout) ===
import { useEffect, useState, useCallback } from "react";
import type { DiaryEntry, ProgressStatus, StyleProfile } from "./types";
import { supabase } from "@/lib/supabase";

const PROFILE_KEY = "bjj.profile.v1";
const PROGRESS_KEY = "bjj.progress.v1";
const DIARY_KEY = "bjj.diary.v1";
const NOTES_KEY = "bjj.notes.v1";
const DEVICE_KEY = "bjj.device.v1";

const DEFAULT_PROFILE: StyleProfile = {
  belt: "white",
  gi: true,
  noGi: true,
  theme: "light",
  locale: "ru",
  onboardingDone: false,
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// === PROFILE HOOK ===
// Общая шина профиля: useProfile вызывается из нескольких мест одновременно
// (страница рендерит AppShell, у обоих свой экземпляр useState). Без общего
// снимка запись из одного экземпляра (онбординг, настройки в AvatarMenu)
// не доходит до остальных до перемонтирования. Схема та же, что у useProgress.
let profileSnapshot: StyleProfile | null = null;
const profileListeners = new Set<(p: StyleProfile) => void>();

function publishProfile(next: StyleProfile) {
  profileSnapshot = next;
  for (const listener of profileListeners) listener(next);
}

export function useProfile() {
  const [profile, setProfile] = useState<StyleProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // merge с дефолтом: у старых профилей могут отсутствовать новые поля (locale и т.п.)
    const initial =
      profileSnapshot ?? { ...DEFAULT_PROFILE, ...readJSON<Partial<StyleProfile>>(PROFILE_KEY, {}) };
    profileSnapshot = initial;
    setProfile(initial);
    setHydrated(true);
    profileListeners.add(setProfile);
    return () => {
      profileListeners.delete(setProfile);
    };
  }, []);

  const update = useCallback((patch: Partial<StyleProfile>) => {
    const next = { ...(profileSnapshot ?? DEFAULT_PROFILE), ...patch };
    writeJSON(PROFILE_KEY, next);
    publishProfile(next);
  }, []);

  return { profile, update, hydrated };
}

// === PROGRESS HOOK ===
// Ключи — id техник (number). В JSON сериализуется как строки — работаем через Record<number,...>.
export type ProgressMap = Record<number, ProgressStatus>;

// Общая шина прогресса. useProgress вызывается из нескольких мест одновременно
// (AppShell + страница, которая его же и рендерит), а каждый вызов хука заводит свой
// useState. Без общего снимка экземпляры расходятся: один пишет localStorage, другие
// об этом не узнают и показывают устаревшие данные до перемонтирования.
// Держим единый снимок + подписчиков, чтобы запись из любого места дошла до всех.
let progressSnapshot: ProgressMap | null = null;
const progressListeners = new Set<(m: ProgressMap) => void>();

function publishProgress(next: ProgressMap) {
  progressSnapshot = next;
  for (const listener of progressListeners) listener(next);
}

export function useProgress() {
  const [progress, setProgressState] = useState<ProgressMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Снимок уже есть (другой экземпляр гидратировался раньше) — берём его, не читаем заново
    const initial = progressSnapshot ?? readJSON<ProgressMap>(PROGRESS_KEY, {});
    progressSnapshot = initial;
    setProgressState(initial);
    setHydrated(true);
    progressListeners.add(setProgressState);

    trySyncFromCloud().then((remote) => {
      if (remote) {
        // Merge стратегия: облако + локальное (локальное имеет приоритет)
        const merged = { ...remote, ...(progressSnapshot ?? {}) };
        writeJSON(PROGRESS_KEY, merged);
        publishProgress(merged);
      }
    });

    return () => {
      progressListeners.delete(setProgressState);
    };
  }, []);

  const setStatus = useCallback((techniqueId: number, status: ProgressStatus) => {
    const next = { ...(progressSnapshot ?? {}), [techniqueId]: status };
    writeJSON(PROGRESS_KEY, next);
    void trySyncToCloud(next);
    publishProgress(next);
  }, []);

  const cycleStatus = useCallback(
    (techniqueId: number) => {
      const order: ProgressStatus[] = ["not_started", "in_progress", "done"];
      const current = (progressSnapshot ?? {})[techniqueId] ?? "not_started";
      const idx = order.indexOf(current);
      const next = order[(idx + 1) % order.length];
      setStatus(techniqueId, next);
    },
    [setStatus],
  );

  // Массовая замена (импорт прогресса, засев из онбординга)
  const setProgress = useCallback((map: ProgressMap) => {
    writeJSON(PROGRESS_KEY, map);
    void trySyncToCloud(map);
    publishProgress(map);
  }, []);

  // Полный сброс прогресса
  const clearProgress = useCallback(() => {
    writeJSON(PROGRESS_KEY, {});
    void trySyncToCloud({});
    publishProgress({});
  }, []);

  return { progress, setStatus, cycleStatus, setProgress, clearProgress, hydrated };
}

// === DIARY HOOK ===
// Дневник тренировок. Записи в localStorage (позже — облачная синхронизация).
export function useDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const list = readJSON<DiaryEntry[]>(DIARY_KEY, []);
    list.sort((a, b) => b.date.localeCompare(a.date));
    setEntries(list);
    setHydrated(true);
  }, []);

  const persist = useCallback((next: DiaryEntry[]) => {
    next.sort((a, b) => b.date.localeCompare(a.date));
    writeJSON(DIARY_KEY, next);
    setEntries(next);
  }, []);

  const addEntry = useCallback(
    (entry: Omit<DiaryEntry, "id">) => {
      // id без Date.now()/random (SSR-safe): дата + счётчик из текущего списка
      setEntries((prev) => {
        const id = `${entry.date}-${prev.length + 1}-${prev.reduce((n, e) => n + e.techniqueIds.length, 0)}`;
        const next = [{ ...entry, id }, ...prev];
        next.sort((a, b) => b.date.localeCompare(a.date));
        writeJSON(DIARY_KEY, next);
        return next;
      });
    },
    [],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<DiaryEntry, "id">>) => setEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e));
      next.sort((a, b) => b.date.localeCompare(a.date));
      writeJSON(DIARY_KEY, next);
      return next;
    }),
    [],
  );

  const deleteEntry = useCallback(
    (id: string) => setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      writeJSON(DIARY_KEY, next);
      return next;
    }),
    [],
  );

  // Сколько раз каждая техника отработана (для рекомендаций «повтори»)
  const practiceCount = useCallback(
    () => {
      const m: Record<number, number> = {};
      for (const e of entries) for (const id of e.techniqueIds) m[id] = (m[id] ?? 0) + 1;
      return m;
    },
    [entries],
  );

  return { entries, addEntry, updateEntry, deleteEntry, practiceCount, persist, hydrated };
}

// === NOTES HOOK ===
// Заметки к техникам: Record<techId, string>. Та же схема, что у useProgress:
// общая шина + localStorage + облако (отдельная колонка notes_data, чтобы не
// толкаться с progress_data при синхронизации с двух устройств).
export type NotesMap = Record<number, string>;

let notesSnapshot: NotesMap | null = null;
const notesListeners = new Set<(m: NotesMap) => void>();

function publishNotes(next: NotesMap) {
  notesSnapshot = next;
  for (const listener of notesListeners) listener(next);
}

export function useNotes() {
  const [notes, setNotesState] = useState<NotesMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = notesSnapshot ?? readJSON<NotesMap>(NOTES_KEY, {});
    notesSnapshot = initial;
    setNotesState(initial);
    setHydrated(true);
    notesListeners.add(setNotesState);

    trySyncNotesFromCloud().then((remote) => {
      if (remote) {
        // Как у прогресса: облако + локальное, локальное главнее по ключу
        const merged = { ...remote, ...(notesSnapshot ?? {}) };
        writeJSON(NOTES_KEY, merged);
        publishNotes(merged);
      }
    });

    return () => {
      notesListeners.delete(setNotesState);
    };
  }, []);

  // Пустая строка удаляет заметку (не копим пустые ключи)
  const setNote = useCallback((techniqueId: number, text: string) => {
    const next = { ...(notesSnapshot ?? {}) };
    if (text.trim()) next[techniqueId] = text;
    else delete next[techniqueId];
    writeJSON(NOTES_KEY, next);
    void trySyncNotesToCloud(next);
    publishNotes(next);
  }, []);

  return { notes, setNote, hydrated };
}

// === CLOUD SYNC (best-effort, 3s timeout) ===
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return await Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function trySyncFromCloud(): Promise<ProgressMap | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const query = supabase
      .from("bjj_progress")
      .select("progress_data")
      .eq("user_id", user.id)
      .maybeSingle();

    const result = await withTimeout(query, 3000);
    if (!result || result.error || !result.data) return null;

    // Преобразуем JSONB в ProgressMap
    const progressMap: ProgressMap = {};
    const data = (result.data.progress_data ?? {}) as Record<string, ProgressStatus>;
    for (const [key, value] of Object.entries(data)) {
      const numKey = Number(key);
      if (!isNaN(numKey) && value) {
        progressMap[numKey] = value;
      }
    }

    return progressMap;
  } catch (e) {
    console.warn("Ошибка синхронизации из облака:", e);
    return null;
  }
}

async function trySyncNotesFromCloud(): Promise<NotesMap | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const query = supabase
      .from("bjj_progress")
      .select("notes_data")
      .eq("user_id", user.id)
      .maybeSingle();

    const result = await withTimeout(query, 3000);
    if (!result || result.error || !result.data) return null;

    const map: NotesMap = {};
    const data = (result.data.notes_data ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(data)) {
      const numKey = Number(key);
      if (!isNaN(numKey) && typeof value === "string" && value) map[numKey] = value;
    }
    return map;
  } catch {
    return null;
  }
}

async function trySyncNotesToCloud(notes: NotesMap): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upsert только своей колонки: progress_data не трогаем
    const notesData: Record<string, string> = {};
    for (const [key, value] of Object.entries(notes)) notesData[String(key)] = value;

    const query = supabase.from("bjj_progress").upsert(
      { user_id: user.id, notes_data: notesData },
      { onConflict: "user_id" },
    );
    const result = await withTimeout(query, 3000);
    if (result && "error" in result && result.error) {
      console.warn("Ошибка сохранения заметок в облако:", result.error.message);
    }
  } catch {
    /* молча: заметки не должны ломать приложение */
  }
}

async function trySyncToCloud(progress: ProgressMap): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Преобразуем ProgressMap в Record<string, ProgressStatus> для JSONB
    const progressData: Record<string, ProgressStatus> = {};
    for (const [key, value] of Object.entries(progress)) {
      progressData[String(key)] = value;
    }

    const query = supabase.from("bjj_progress").upsert(
      {
        user_id: user.id,
        progress_data: progressData,
      },
      { onConflict: "user_id" }
    );

    const result = await withTimeout(query, 3000);
    if (result && 'error' in result && result.error) {
      console.warn("Ошибка сохранения в облако:", result.error.message);
    }
  } catch (e) {
    console.warn("Ошибка синхронизации в облако:", e);
  }
}
