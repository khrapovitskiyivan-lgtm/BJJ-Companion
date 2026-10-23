import { createFileRoute } from "@tanstack/react-router";
import { validateInitData } from "@/lib/tgValidate";

// Доверенный роут отчёта для напоминаний бота. Раньше клиент звал bjj_tg_report
// anon-ключом с p_tg из клиента — любой мог переписать чужой план. Теперь tg id
// берётся только из проверенной подписи initData, RPC зовётся сервисным ключом.

interface ReportBody {
  initData?: string;
  payload?: Record<string, unknown>;
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const clampInt = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null;

export const Route = createFileRoute("/api/tg-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const url = process.env.VITE_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!token || !url || !key) return new Response("not configured", { status: 503 });

        let body: ReportBody;
        try {
          body = (await request.json()) as ReportBody;
        } catch {
          return new Response("bad request", { status: 400 });
        }
        const { ok, user } = validateInitData(body.initData ?? "", token);
        if (!ok || !user?.id) return new Response("forbidden", { status: 403 });

        const p = body.payload ?? {};
        const days = Array.isArray(p.training_days)
          ? (p.training_days as unknown[]).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
          : [];
        const r = await fetch(`${url}/rest/v1/rpc/bjj_tg_report`, {
          method: "POST",
          headers: { apikey: key, authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            p_tg: user.id,
            p_device: typeof p.device === "string" ? p.device : null,
            p_frequency: clampInt(p.frequency, 1, 7),
            p_week_start: isDate(p.week_start) ? p.week_start : null,
            p_week_done: clampInt(p.week_done, 0, 50) ?? 0,
            p_last_entry: isDate(p.last_entry) ? p.last_entry : null,
            p_training_days: days.length ? days : [0, 1, 2, 3, 4, 5],
            p_paused_until: isDate(p.paused_until) ? p.paused_until : null,
          }),
        });
        return new Response(null, { status: r.ok ? 204 : 502 });
      },
    },
  },
});
