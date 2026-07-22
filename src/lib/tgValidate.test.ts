import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { validateInitData } from "./tgValidate";

// Подписать поля тем же алгоритмом, что и Telegram (для теста).
function sign(fields: Record<string, string>, token: string): string {
  const dcs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dcs).digest("hex");
  const p = new URLSearchParams(fields);
  p.set("hash", hash);
  return p.toString();
}

const TOKEN = "123456:test-bot-token";
const FIELDS = {
  auth_date: "1700000000",
  query_id: "AAH0abc",
  user: JSON.stringify({
    id: 42,
    first_name: "Иван",
    username: "ivan",
    photo_url: "https://x/p.jpg",
  }),
};

describe("validateInitData", () => {
  it("принимает корректную подпись и достаёт пользователя", () => {
    const res = validateInitData(sign(FIELDS, TOKEN), TOKEN);
    expect(res.ok).toBe(true);
    expect(res.user?.id).toBe(42);
    expect(res.user?.first_name).toBe("Иван");
    expect(res.user?.photo_url).toBe("https://x/p.jpg");
  });

  it("отвергает чужой токен", () => {
    expect(validateInitData(sign(FIELDS, TOKEN), "other-token").ok).toBe(false);
  });

  it("отвергает подделанные данные", () => {
    const good = sign(FIELDS, TOKEN);
    const tampered = good.replace("auth_date=1700000000", "auth_date=1700000001");
    expect(validateInitData(tampered, TOKEN).ok).toBe(false);
  });

  it("отвергает без hash и пустой ввод", () => {
    expect(validateInitData("auth_date=1", TOKEN).ok).toBe(false);
    expect(validateInitData("", TOKEN).ok).toBe(false);
    expect(validateInitData(sign(FIELDS, TOKEN), "").ok).toBe(false);
  });
});
