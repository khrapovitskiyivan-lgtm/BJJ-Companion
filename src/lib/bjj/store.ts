// === STORE (localStorage + optional Cloud sync с 3s timeout) ===
import { useEffect, useState, useCallback } from "react";
import type { ProgressStatus, StyleProfile } from "./types";
import { supabase } from "@/integrations/supabase/client";

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
    const deviceId = getDeviceId();
    // Таблица bjj_progress пока не создана — блок оставлен как точка расширения.
    const query = (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: string) => Promise<{ data?: Array<{ technique_id: number; status: ProgressStatus }>; error?: unknown }>;
        };
      };
    })
      .from("bjj_progress")
      .select("technique_id, status")
      .eq("device_id", deviceId);
    const result = await withTimeout(query, 3000);
    if (!result || result.error || !result.data) return null;
    const map: ProgressMap = {};
    for (const r of result.data) map[Number(r.technique_id)] = r.status;
    return map;
  } catch {
    return null;
  }
}

async function trySyncToCloud(_progress: ProgressMap): Promise<void> {
  // Placeholder — таблица не создаётся автоматически. localStorage — источник истины.
  // При включении таблицы bjj_progress здесь можно делать upsert.
  return;
}
