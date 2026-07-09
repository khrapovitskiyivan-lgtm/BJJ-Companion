// === STORE (localStorage + optional Cloud sync с 3s timeout) ===
import { useEffect, useState, useCallback } from "react";
import type { ProgressStatus, StyleProfile } from "./types";
import { supabase } from "@/lib/supabase";

const PROFILE_KEY = "bjj.profile.v1";
const PROGRESS_KEY = "bjj.progress.v1";
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
export function useProfile() {
  const [profile, setProfile] = useState<StyleProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // merge с дефолтом: у старых профилей могут отсутствовать новые поля (locale и т.п.)
    setProfile({ ...DEFAULT_PROFILE, ...readJSON<Partial<StyleProfile>>(PROFILE_KEY, {}) });
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<StyleProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      writeJSON(PROFILE_KEY, next);
      return next;
    });
  }, []);

  return { profile, update, hydrated };
}

// === PROGRESS HOOK ===
// Ключи — id техник (number). В JSON сериализуется как строки — работаем через Record<number,...>.
export type ProgressMap = Record<number, ProgressStatus>;

export function useProgress() {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(readJSON<ProgressMap>(PROGRESS_KEY, {}));
    setHydrated(true);
    trySyncFromCloud().then((remote) => {
      if (remote) {
        setProgress((prev) => {
          // Merge стратегия: облако + локальное (локальное имеет приоритет)
          const merged = { ...remote, ...prev };
          writeJSON(PROGRESS_KEY, merged);
          return merged;
        });
      }
    });
  }, []);

  const setStatus = useCallback((techniqueId: number, status: ProgressStatus) => {
    setProgress((prev) => {
      const next = { ...prev, [techniqueId]: status };
      writeJSON(PROGRESS_KEY, next);
      void trySyncToCloud(next);
      return next;
    });
  }, []);

  const cycleStatus = useCallback(
    (techniqueId: number) => {
      const order: ProgressStatus[] = ["not_started", "in_progress", "done"];
      const current = progress[techniqueId] ?? "not_started";
      const idx = order.indexOf(current);
      const next = order[(idx + 1) % order.length];
      setStatus(techniqueId, next);
    },
    [progress, setStatus],
  );

  return { progress, setStatus, cycleStatus, hydrated };
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
