import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";
import { Onboarding } from "./Onboarding";
import { ConsentGate } from "./ConsentGate";
import { Logo } from "./Logo";
import { AvatarMenu } from "./AvatarMenu";
import {
  CONSENT_VERSION,
  getDeviceId,
  hasConsent,
  useDiary,
  useProfile,
  useProgress,
} from "@/lib/bjj/store";
import { reportPlayer } from "@/lib/bjj/globalStats";
import { reportTgPlan } from "@/lib/bjj/tgReport";
import { reportPartnerProfile } from "@/lib/bjj/reportPartnerProfile";
import { buildPublishInput } from "@/lib/bjj/partnersProfile";
import {
  listPartners,
  markPartnersJoined,
  isPartnersJoined,
  setPendingInvite,
} from "@/lib/bjj/partners";
import { track } from "@/lib/bjj/telemetry";
import { initTelegram, haptic, markThemeManual, isTelegram, getStartParam } from "@/lib/telegram";
import { Moon, Sun, Settings } from "lucide-react";

// Инициалы из имени для фоллбэк-аватара (когда фото из Telegram недоступно).
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Разделы для телеметрии section_open (карточки техник и /about не считаем)
const TELEMETRY_SECTIONS: Record<string, string> = {
  "/progress": "progress",
  "/diary": "diary",
  "/map": "map",
  "/library": "library",
  "/situations": "situations",
  "/glossary": "glossary",
  "/workout": "workout",
};

// Самообнаружение участия в партнёрах — раз за загрузку страницы (не на каждую навигацию)
let partnerDiscoveryTried = false;

// === APP SHELL ===
// Шапка: тема слева · лого+название по центру · аватар справа.
// Тап по аватару открывает меню (статистика · настройки · о приложении) — AvatarMenu.
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { profile, update, hydrated } = useProfile();
  const { progress, setProgress } = useProgress();
  const { entries, practiceCount } = useDiary();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", profile.theme === "dark");
  }, [profile.theme, hydrated]);

  // Ловим код приглашения партнёра сразу при запуске — ДО гейта/онбординга, пока
  // start_param ещё доступен. Показ промпта — позже, в PartnersBlock (после онбординга).
  useEffect(() => {
    if (!hydrated) return;
    const code = getStartParam();
    if (code && /^[A-Z0-9]{8}$/.test(code)) setPendingInvite(code);
  }, [hydrated]);

  // Анонимный отчёт в глобальную статистику (device_id + пояс); троттлинг внутри
  useEffect(() => {
    if (!hydrated || !profile.onboardingDone) return;
    reportPlayer(profile.belt);
  }, [hydrated, profile.onboardingDone, profile.belt]);

  // Отчёт для напоминаний бота (только внутри Telegram; троттлинг и гейт внутри)
  useEffect(() => {
    if (!hydrated || !profile.onboardingDone) return;
    reportTgPlan(profile.frequency, entries, profile.trainingDays);
  }, [hydrated, profile.onboardingDone, profile.frequency, profile.trainingDays, entries]);

  // Свежесть публичного профиля партнёра (гейт/дедуп внутри). Здесь, а не в
  // PartnersBlock: AppShell смонтирован всегда и видит свежий дневник на навигации.
  useEffect(() => {
    if (!hydrated || !profile.onboardingDone) return;
    reportPartnerProfile(
      buildPublishInput({
        device: getDeviceId(),
        profile,
        progress,
        practiceCount: practiceCount(),
        entries,
        today: new Date(),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    profile.onboardingDone,
    profile.belt,
    profile.gi,
    profile.noGi,
    profile.frequency,
    profile.trainingDays,
    progress,
    entries,
  ]);

  // Самообнаружение участия: если партнёры на сервере есть, а флаг не стоит (напр.
  // принял приглашение до появления флага, или не заходил на «Мою игру») — помечаем
  // участником и сразу публикуем актуальный статус. Раз за загрузку страницы.
  useEffect(() => {
    if (!hydrated || !profile.onboardingDone) return;
    if (partnerDiscoveryTried || !isTelegram() || !hasConsent() || isPartnersJoined()) return;
    partnerDiscoveryTried = true;
    listPartners().then((list) => {
      if (list.length === 0) return;
      markPartnersJoined();
      reportPartnerProfile(
        buildPublishInput({
          device: getDeviceId(),
          profile,
          progress,
          practiceCount: practiceCount(),
          entries,
          today: new Date(),
        }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, profile.onboardingDone]);

  // Telegram Mini App: подтянуть имя/фото/язык из Telegram (один раз после гидратации)
  useEffect(() => {
    if (!hydrated) return;
    initTelegram(update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Телеметрия: app_open без гейта онбординга (видна конверсия), разделы — после
  useEffect(() => {
    if (!hydrated) return;
    track("app_open", isTelegram() ? "tg" : "web", { dailyDedup: true });
    const section = TELEMETRY_SECTIONS[pathname];
    if (section && profile.onboardingDone) track("section_open", section, { dailyDedup: true });
  }, [hydrated, profile.onboardingDone, pathname]);

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  // Гейт согласия: до онбординга и до любой отправки на сервер. Показывается,
  // пока согласие не пройдено для текущей версии (в т.ч. существующим
  // пользователям после bump CONSENT_VERSION).
  if ((profile.consentVersion ?? 0) < CONSENT_VERSION) {
    const stamp = () => ({ consentVersion: CONSENT_VERSION, consentAt: new Date().toISOString() });
    return (
      <ConsentGate
        onAccept={() => {
          update({ consentChoice: "accepted", ...stamp() });
          track("consent", "accept"); // hasConsent() уже true (update пишет синхронно)
        }}
        onLocal={() => update({ consentChoice: "local", ...stamp() })}
      />
    );
  }

  if (!profile.onboardingDone) {
    return (
      <Onboarding
        onDone={(p, knownIds) => {
          // Отмеченные в опросе техники — сразу «изучено» (одной массовой записью)
          if (knownIds.length) {
            const next = { ...progress };
            for (const id of knownIds) next[id] = "done";
            setProgress(next);
          }
          update({ ...p, onboardingDone: true });
          track("onboarding_done");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5">
          {/* слева: тема */}
          <div className="justify-self-start">
            <button
              type="button"
              onClick={() => {
                haptic("light");
                markThemeManual();
                update({ theme: profile.theme === "dark" ? "light" : "dark" });
              }}
              style={{ marginTop: "var(--tg-content-safe-area-inset-top, 0px)" }}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
              aria-label="Переключить тему"
            >
              {profile.theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
          {/* центр: лого + название — бренд-знак без действия (сообщество живёт в блоке «Партнёры») */}
          <div className="flex items-center gap-2 justify-self-center">
            <Logo size={36} />
            <span className="text-lg font-bold tracking-tight">BJJ Companion</span>
          </div>
          {/* справа: настройки и информация (язык, аккаунт, о приложении) */}
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setMenuOpen(true);
            }}
            aria-label="Настройки и информация"
            style={{ marginTop: "var(--tg-content-safe-area-inset-top, 0px)" }}
            className="justify-self-end rounded-full p-2 text-muted-foreground transition hover:bg-muted"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className={`mx-auto px-4 py-4 ${wide ? "max-w-6xl" : "max-w-xl"}`}>{children}</main>
      <BottomNav />
      {menuOpen && <AvatarMenu onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
