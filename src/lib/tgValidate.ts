import { createHmac, timingSafeEqual } from "node:crypto";

// Проверка подписи Telegram Mini App initData (серверная, ботовым токеном).
// Алгоритм Telegram: secret_key = HMAC_SHA256(key="WebAppData", data=bot_token);
// проверочный хэш = HMAC_SHA256(key=secret_key, data=data_check_string), где
// data_check_string — все поля кроме hash, отсортированные, "key=value" через \n.
// Только для сервера (использует node:crypto) — в клиентский бандл не тянуть.

export interface TgInitUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export function validateInitData(
  initData: string,
  botToken: string,
): { ok: boolean; user?: TgInitUser } {
  if (!initData || !botToken) return { ok: false };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };
  params.delete("hash");

  // decoded-значения (как отдаёт URLSearchParams) — это то, что подписывает Telegram
  const dcs = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const check = createHmac("sha256", secret).update(dcs).digest("hex");

  // сравнение постоянного времени; при разной длине hex timingSafeEqual бросает — гасим
  let equal = false;
  try {
    const a = Buffer.from(check, "hex");
    const b = Buffer.from(hash, "hex");
    equal = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    equal = false;
  }
  if (!equal) return { ok: false };

  let user: TgInitUser | undefined;
  const raw = params.get("user");
  if (raw) {
    try {
      user = JSON.parse(raw) as TgInitUser;
    } catch {
      /* ignore */
    }
  }
  return { ok: true, user };
}
