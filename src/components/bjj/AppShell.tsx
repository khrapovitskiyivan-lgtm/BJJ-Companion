import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";
import { Onboarding } from "./Onboarding";
import { Logo } from "./Logo";
import { AvatarMenu } from "./AvatarMenu";
import { useProfile } from "@/lib/bjj/store";
import { initTelegram, haptic } from "@/lib/telegram";
import { BELT_LABEL } from "@/lib/bjj/constants";
import { Moon, Sun } from "lucide-react";

// Инициалы из имени для фоллбэк-аватара (когда фото из Telegram недоступно).
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// === APP SHELL ===
// Шапка: тема слева · лого+название по центру · аватар справа.
// Тап по аватару открывает меню (статистика · настройки · о приложении) — AvatarMenu.
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { profile, update, hydrated } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", profile.theme === "dark");
  }, [profile.theme, hydrated]);

  // Telegram Mini App: подтянуть имя/фото/язык из Telegram (один раз после гидратации)
  useEffect(() => {
    if (!hydrated) return;
    initTelegram(update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!profile.onboardingDone) {
    return <Onboarding onDone={(p) => update({ ...p, onboardingDone: true })} />;
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
              onClick={() => { haptic("light"); update({ theme: profile.theme === "dark" ? "light" : "dark" }); }}
              style={{ marginTop: "var(--tg-content-safe-area-inset-top, 0px)" }}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
              aria-label="Переключить тему"
            >
              {profile.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          {/* центр: лого + название */}
          <Link to="/" className="flex items-center gap-2 justify-self-center">
            <Logo size={26} />
            <span className="text-sm font-bold tracking-tight">BJJ Companion</span>
          </Link>
          {/* справа: аватар — открывает меню (статистика · настройки · о приложении) */}
          <button
            type="button"
            onClick={() => { haptic("light"); setMenuOpen(true); }}
            aria-label={`Меню профиля: ${BELT_LABEL[profile.belt]} пояс`}
            style={{ marginTop: "var(--tg-content-safe-area-inset-top, 0px)" }}
            className="justify-self-end rounded-full p-1 transition hover:bg-muted"
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="block h-7 w-7 rounded-full object-cover ring-2"
                style={{ boxShadow: `0 0 0 2px var(--belt-${profile.belt})` }}
              />
            ) : profile.name ? (
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white ring-2 ring-border"
                style={{ background: `var(--belt-${profile.belt})` }}
              >
                {initials(profile.name)}
              </span>
            ) : (
              <span
                className="block h-7 w-7 rounded-full ring-2 ring-border"
                style={{ background: `var(--belt-${profile.belt})` }}
              />
            )}
          </button>
        </div>
      </header>
      <main className={`mx-auto px-4 py-4 ${wide ? "max-w-6xl" : "max-w-xl"}`}>{children}</main>
      <BottomNav />
      {menuOpen && <AvatarMenu onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
