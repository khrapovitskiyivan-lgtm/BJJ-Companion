import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";
import { Onboarding } from "./Onboarding";
import { Logo } from "./Logo";
import { useProfile } from "@/lib/bjj/store";
import { BELT_LABEL } from "@/lib/bjj/constants";
import { Moon, Sun } from "lucide-react";

// === APP SHELL ===
// Шапка: тема слева · лого+название по центру · профиль справа.
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { profile, update, hydrated } = useProfile();

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", profile.theme === "dark");
  }, [profile.theme, hydrated]);

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!profile.onboardingDone) {
    return <Onboarding onDone={(p) => update({ ...p, onboardingDone: true })} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5">
          {/* слева: тема */}
          <div className="justify-self-start">
            <button
              type="button"
              onClick={() => update({ theme: profile.theme === "dark" ? "light" : "dark" })}
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
          {/* справа: профиль (аватар-пояс) */}
          <Link
            to="/profile"
            aria-label={`Профиль: ${BELT_LABEL[profile.belt]} пояс`}
            className="justify-self-end rounded-full p-1 transition hover:bg-muted"
          >
            <span
              className="block h-7 w-7 rounded-full ring-2 ring-border"
              style={{ background: `var(--belt-${profile.belt})` }}
            />
          </Link>
        </div>
      </header>
      <main className={`mx-auto px-4 py-4 ${wide ? "max-w-6xl" : "max-w-xl"}`}>{children}</main>
      <BottomNav />
    </div>
  );
}
