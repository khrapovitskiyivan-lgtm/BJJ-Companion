import { createFileRoute } from "@tanstack/react-router";

// Вебхук Telegram-бота (@companionminiapp_bot): вступительное сообщение на /start.
// Токен и секрет живут в env БЕЗ префикса VITE_ — на сервере, в бандл не попадают.
// Настройка: setWebhook на https://bjj-companionkhr.vercel.app/api/tg-webhook
// с secret_token; чужие запросы отсекаются по заголовку.

const APP_URL = "https://bjj-companionkhr.vercel.app";

const WELCOME = [
  "Привет! Это BJJ Companion — ежедневник для бразильского джиу-джитсу.",
  "",
  "Отмечай тренировки в дневнике, смотри свой стиль и прогресс, разбирай ситуации и получай рекомендации, что учить дальше. База: 293 техники от белого до чёрного пояса.",
  "",
  "Открой приложение кнопкой ниже — или через кнопку меню в этом чате.",
].join("\n");

interface TgUpdate {
  message?: { chat?: { id?: number }; text?: string };
}

export const Route = createFileRoute("/api/tg-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (!token) return new Response("not configured", { status: 500 });
        if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
          return new Response("forbidden", { status: 403 });
        }
        try {
          const update = (await request.json()) as TgUpdate;
          const chatId = update.message?.chat?.id;
          const text = update.message?.text ?? "";
          if (chatId && text.startsWith("/start")) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: WELCOME,
                reply_markup: {
                  inline_keyboard: [[{ text: "Открыть BJJ Companion", web_app: { url: APP_URL } }]],
                },
              }),
            });
          }
        } catch {
          // битый апдейт: отвечаем 200, чтобы Telegram не заваливал ретраями
        }
        return Response.json({ ok: true });
      },
    },
  },
});
