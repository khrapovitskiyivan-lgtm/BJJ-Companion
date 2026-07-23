import { createFileRoute } from "@tanstack/react-router";
import { decide, type TgChatRow } from "@/lib/bjj/tgRemind";

// Ежедневный крон напоминаний (vercel.json: 17:00 UTC = 20:00 МСК).
// Читает bjj_tg_chats service-role-ключом (только env, в бандл не попадает),
// решает по каждому чату через decide() и шлёт сообщения ботом.
// Защита: Vercel сам шлёт Authorization: Bearer CRON_SECRET.

const APP_URL = "https://bjj-companionkhr.vercel.app";
const MSK_MS = 3 * 60 * 60 * 1000; // МСК = UTC+3, переходов на летнее время нет

export const Route = createFileRoute("/api/tg-cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        const supaUrl = process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!cronSecret || !supaUrl || !serviceKey || !botToken) {
          return new Response("not configured", { status: 503 });
        }
        if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
          return new Response("forbidden", { status: 403 });
        }

        // «Сегодня» по Москве: сдвигаем UTC и читаем UTC-геттеры
        const msk = new Date(Date.now() + MSK_MS);
        const todayIso = msk.toISOString().slice(0, 10);
        const dow = msk.getUTCDay() === 0 ? 7 : msk.getUTCDay(); // 1=Пн..7=Вс
        const monday = new Date(msk);
        monday.setUTCDate(monday.getUTCDate() - (dow - 1));
        const mondayIso = monday.toISOString().slice(0, 10);

        const supaHeaders = {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        };

        const rows = (await fetch(
          `${supaUrl}/rest/v1/bjj_tg_chats?muted=eq.false&frequency=not.is.null&select=*`,
          { headers: supaHeaders },
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])) as TgChatRow[];

        let sent = 0;
        for (const row of rows) {
          const d = decide(row, todayIso, dow, mondayIso);
          if (d.kind === "none") continue;

          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: row.tg_user_id,
              text: d.text,
              reply_markup: {
                inline_keyboard: [[{ text: "Открыть дневник", web_app: { url: `${APP_URL}/diary` } }]],
              },
            }),
          }).catch(() => null);

          if (res?.ok) {
            sent++;
            const patch: Record<string, unknown> = { last_ping: todayIso };
            if (d.kind === "soft") {
              const used = row.soft_ping_week === mondayIso ? row.soft_ping_count : 0;
              patch.soft_ping_week = mondayIso;
              patch.soft_ping_count = used + 1;
            }
            await fetch(`${supaUrl}/rest/v1/bjj_tg_chats?tg_user_id=eq.${row.tg_user_id}`, {
              method: "PATCH",
              headers: { ...supaHeaders, Prefer: "return=minimal" },
              body: JSON.stringify(patch),
            }).catch(() => {});
          } else if (res?.status === 403) {
            // пользователь заблокировал бота — больше не пытаемся
            await fetch(`${supaUrl}/rest/v1/bjj_tg_chats?tg_user_id=eq.${row.tg_user_id}`, {
              method: "PATCH",
              headers: { ...supaHeaders, Prefer: "return=minimal" },
              body: JSON.stringify({ muted: true }),
            }).catch(() => {});
          }
        }

        return Response.json({ ok: true, day: todayIso, dow, checked: rows.length, sent });
      },
    },
  },
});
