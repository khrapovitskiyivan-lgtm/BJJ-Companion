import { supabase } from "@/lib/supabase";
import { getDeviceId, hasConsent } from "./store";

// Телеметрия событий: анонимные счётчики использования (device_id + имя события
// + короткая метка), запись через security definer RPC bjj_track
// (docs/sql/2026-07-18-telemetry.sql). Никакого содержимого записей и заметок.
// Fire-and-forget: сбой сети или отсутствие таблицы не мешают приложению.

export type TelemetryEvent =
  | "app_open"
  | "onboarding_done"
  | "entry_saved"
  | "caught_logged"
  | "workout_run"
  | "workout_filter"
  | "scenario_run"
  | "section_open"
  | "reco_click"
  | "note_saved"
  | "consent"
  | "invite_created"
  | "invite_accepted"
  | "partner_opened"
  | "pro_video_interest"
  | "review_opened"
  | "review_drill"
  | "partner_nudge"
  | "favorite_toggle"
  | "level_up";

const DEDUP_KEY = "bjj.telemetry.v1";
const DAY = 24 * 60 * 60 * 1000;

// dailyDedup: не чаще раза в сутки на связку событие+detail (отметка ставится
// до отправки — потерянное из-за сети событие дня не ретраится, зато нет спама).
export function track(
  event: TelemetryEvent,
  detail?: string,
  opts: { dailyDedup?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  if (!hasConsent()) return; // без согласия ничего на сервер не уходит
  try {
    if (opts.dailyDedup) {
      const key = `${event}:${detail ?? ""}`;
      const map = JSON.parse(localStorage.getItem(DEDUP_KEY) ?? "{}") as Record<string, number>;
      if (Date.now() - (map[key] ?? 0) < DAY) return;
      map[key] = Date.now();
      localStorage.setItem(DEDUP_KEY, JSON.stringify(map));
    }
    void Promise.resolve(
      supabase.rpc("bjj_track", {
        p_device: getDeviceId(),
        p_event: event,
        p_detail: detail ?? null,
      }),
    ).catch(() => null);
  } catch {
    // молча: телеметрия не важнее пользователя
  }
}
