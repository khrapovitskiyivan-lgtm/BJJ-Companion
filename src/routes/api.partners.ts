import { createFileRoute } from "@tanstack/react-router";
import { validateInitData } from "@/lib/tgValidate";

// Доверенный роут партнёров: проверяет подпись Telegram initData ботовым токеном,
// достаёт ПРОВЕРЕННЫЙ tg id (имя/фото — тоже из подписанных данных, не от клиента),
// и зовёт security definer RPC сервисным ключом. Клиент напрямую в базу по
// партнёрам не ходит — подделать чужой id нельзя. Токен и сервисный ключ в env.

interface PartnersBody {
  initData?: string;
  action?: "publish" | "accept" | "list" | "remove";
  payload?: Record<string, unknown>;
}

async function callRpc(fn: string, body: Record<string, unknown>): Promise<unknown> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

// Отображаемое имя из подписанных данных Telegram (имя не берём с клиента)
function displayName(u: { first_name?: string; last_name?: string; username?: string }): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username || "";
}

export const Route = createFileRoute("/api/partners")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const supaUrl = process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!token || !supaUrl || !serviceKey) {
          return new Response("not configured", { status: 503 });
        }

        let body: PartnersBody;
        try {
          body = (await request.json()) as PartnersBody;
        } catch {
          return new Response("bad request", { status: 400 });
        }

        const { ok, user } = validateInitData(body.initData ?? "", token);
        if (!ok || !user?.id) {
          return new Response("forbidden", { status: 403 });
        }

        const tg = user.id;
        const p = body.payload ?? {};

        switch (body.action) {
          case "publish": {
            const code = await callRpc("bjj_partner_publish", {
              p_tg: tg,
              p_device: (p.device as string) ?? null,
              p_name: displayName(user),
              p_photo: user.photo_url ?? null,
              p_belt: (p.belt as string) ?? null,
              p_gi: (p.gi as boolean) ?? true,
              p_nogi: (p.nogi as boolean) ?? true,
              p_style: (p.style as string) ?? null,
              p_stats: (p.stats as Record<string, number>) ?? {},
              p_week_start: (p.weekStart as string) ?? null,
              p_week_done: (p.weekDone as number) ?? 0,
              p_quota: (p.quota as number) ?? null,
              p_streak: (p.streak as number) ?? 0,
            });
            return Response.json({ code });
          }
          case "accept": {
            const status = await callRpc("bjj_partner_accept", {
              p_tg: tg,
              p_ref: (p.ref as string) ?? "",
            });
            return Response.json({ status });
          }
          case "list": {
            const partners = await callRpc("bjj_partner_list", { p_tg: tg });
            return Response.json({ partners: partners ?? [] });
          }
          case "remove": {
            await callRpc("bjj_partner_remove", { p_tg: tg, p_other: (p.other as number) ?? 0 });
            return Response.json({ ok: true });
          }
          default:
            return new Response("bad action", { status: 400 });
        }
      },
    },
  },
});
