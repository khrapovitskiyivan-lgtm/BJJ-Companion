import { createFileRoute } from "@tanstack/react-router";

// Вебхук Telegram-бота (@companionminiapp_bot): вступительное сообщение на /start.
// Токен и секрет живут в env БЕЗ префикса VITE_ — на сервере, в бандл не попадают.
// Настройка: setWebhook на https://bjj-companionkhr.vercel.app/api/tg-webhook
// с secret_token; чужие запросы отсекаются по заголовку.

const APP_URL = "https://bjj-companionkhr.vercel.app";

const COMMANDS_HINT = [
  "Команды:",
  "/help — как пользоваться",
  "/about — что это за приложение",
  "/train — готовая тренировка",
  "/diary — отметить тренировку",
  "/mute — выключить напоминания",
].join("\n");

const WELCOME = [
  "Привет! Это BJJ Companion — ежедневник для бразильского джиу-джитсу.",
  "",
  "Отмечай тренировки в дневнике, смотри свой стиль и прогресс, разбирай ситуации и получай рекомендации, что учить дальше. База: 293 техники от белого до чёрного пояса.",
  "",
  COMMANDS_HINT,
  "",
  "Открой приложение кнопкой ниже — или через кнопку меню в этом чате.",
].join("\n");

const HELP = [
  "Как пользоваться:",
  "",
  "Дневник — отмечай каждую тренировку: календарь покажет план недели и серию недель в плане.",
  "Тренировка — готовый комплекс по профилю или по дневнику, с таймером и звуком.",
  "Техники — библиотека, карта связей, разбор ситуаций «Что если» и словарь.",
  "Моя игра — стиль, характеристики, прогресс по поясам и группам.",
  "",
  "Напоминания: если план недели горит, бот напомнит вечером (пн-пт) и подведёт итог в воскресенье. Выключить: /mute, включить: /unmute.",
  "",
  COMMANDS_HINT,
].join("\n");

const ABOUT = [
  "BJJ Companion — не справочник, а ежедневник для бразильского джиу-джитсу.",
  "",
  "Логируешь тренировки — приложение видит твой стиль, считает план и подсказывает, что учить и что повторить. 293 техники от белого до чёрного пояса, умный генератор тренировок, разбор ситуаций.",
  "",
  "Бесплатно, работает прямо в Telegram.",
].join("\n");

// Кнопка открытия приложения (web_app-кнопки работают в личке с ботом)
const appButton = (label: string, path = "") => ({
  inline_keyboard: [[{ text: label, web_app: { url: APP_URL + path } }]],
});

// Ответы бота: команда -> текст + кнопка в нужный раздел
const REPLIES: Record<string, { text: string; reply_markup: unknown }> = {
  "/start": { text: WELCOME, reply_markup: appButton("Открыть BJJ Companion") },
  "/help": { text: HELP, reply_markup: appButton("Открыть BJJ Companion") },
  "/about": { text: ABOUT, reply_markup: appButton("Открыть BJJ Companion") },
  "/train": {
    text: "Готовая тренировка уже собрана — открой и жми Старт.",
    reply_markup: appButton("Открыть тренировку", "/workout"),
  },
  "/diary": {
    text: "Отметь сегодняшнюю тренировку — календарь и план обновятся сами.",
    reply_markup: appButton("Открыть дневник", "/diary"),
  },
};

interface TgUpdate {
  message?: { chat?: { id?: number }; text?: string };
}

// /mute и /unmute: security definer RPC тем же anon-ключом, что у приложения
async function setMuted(chatId: number, muted: boolean): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/bjj_tg_set_muted`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_tg: chatId, p_muted: muted }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const MUTE_REPLIES: Record<string, { ok: string; fail: string; muted: boolean }> = {
  "/mute": {
    muted: true,
    ok: "Напоминания выключены. Включить обратно: /unmute",
    fail: "Не получилось выключить напоминания, попробуй позже.",
  },
  "/unmute": {
    muted: false,
    ok: "Напоминания включены: если план недели горит, напомню вечером (пн-пт), в воскресенье подведу итог.",
    fail: "Не получилось включить напоминания, попробуй позже.",
  },
};

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
          // «/команда» и «/команда@имябота» из меню команд
          const command = text.split(/[\s@]/, 1)[0];
          const muteCmd = MUTE_REPLIES[command];
          const reply = REPLIES[command];
          if (chatId && muteCmd) {
            const ok = await setMuted(chatId, muteCmd.muted);
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: ok ? muteCmd.ok : muteCmd.fail }),
            });
          } else if (chatId && reply) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: reply.text, reply_markup: reply.reply_markup }),
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
