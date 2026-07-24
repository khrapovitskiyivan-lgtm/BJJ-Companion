import { isTelegram } from "@/lib/telegram";
import { hasConsent } from "./consent";
import { publishProfile, isPartnersJoined, type PublishInput } from "./partners";

// Держит публичный профиль партнёра свежим. Зовётся из AppShell при изменении
// дневника/прогресса/профиля (AppShell смонтирован всегда и перечитывает данные
// на каждой навигации — тот же приём, что у reportTgPlan). Только в Telegram, при
// согласии и если пользователь участвует в партнёрах. Дедуп по содержимому:
// публикуем, только когда данные реально изменились.

const KEY = "bjj.partnerProfile.v1";

export function reportPartnerProfile(input: PublishInput): void {
  if (typeof window === "undefined" || !isTelegram() || !hasConsent() || !isPartnersJoined())
    return;
  try {
    const hash = JSON.stringify([
      input.belt,
      input.gi,
      input.nogi,
      input.style,
      input.stats,
      input.weekStart,
      input.weekDone,
      input.quota,
      input.streak,
      input.level,
    ]);
    if (localStorage.getItem(KEY) === hash) return;
    void publishProfile(input).then((code) => {
      if (code) localStorage.setItem(KEY, hash);
    });
  } catch {
    // молча: партнёры не должны ломать приложение
  }
}
