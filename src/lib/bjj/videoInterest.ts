import { track } from "./telemetry";

// Локальная отметка «интересно видео по технике» + одно событие спроса на технику.
// Дедуп множеством в localStorage: одно устройство = один интерес на технику,
// повторный тап не шлёт событие и не перезаписывает.

const KEY = "bjj.videoInterest.v1";

function read(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function hasVideoInterest(id: number): boolean {
  if (typeof window === "undefined") return false;
  return read().has(id);
}

export function markVideoInterest(id: number): void {
  if (typeof window === "undefined") return;
  const set = read();
  if (set.has(id)) return;
  set.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // молча: интерес не важнее пользователя
  }
  track("pro_video_interest", String(id));
}
